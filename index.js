// server/index.ts
import express2 from "express";

// server/routes.ts
import { createServer } from "http";

// server/storage.ts
var MemStorage = class {
  extractions;
  extractedImages;
  currentExtractionId;
  currentImageId;
  constructor() {
    this.extractions = /* @__PURE__ */ new Map();
    this.extractedImages = /* @__PURE__ */ new Map();
    this.currentExtractionId = 1;
    this.currentImageId = 1;
  }
  async createExtraction(insertExtraction) {
    const id = this.currentExtractionId++;
    const extraction = {
      ...insertExtraction,
      id,
      imageCount: 0,
      createdAt: /* @__PURE__ */ new Date()
    };
    this.extractions.set(id, extraction);
    return extraction;
  }
  async getExtraction(id) {
    return this.extractions.get(id);
  }
  async createExtractedImage(insertImage) {
    const id = this.currentImageId++;
    const image = {
      ...insertImage,
      id,
      width: insertImage.width ?? null,
      height: insertImage.height ?? null,
      fileSize: insertImage.fileSize ?? null,
      format: insertImage.format ?? null,
      alt: insertImage.alt ?? null,
      isBackground: insertImage.isBackground ?? false,
      isLazyLoaded: insertImage.isLazyLoaded ?? false
    };
    this.extractedImages.set(id, image);
    const extraction = this.extractions.get(insertImage.extractionId);
    if (extraction) {
      extraction.imageCount++;
      this.extractions.set(extraction.id, extraction);
    }
    return image;
  }
  async getImagesByExtractionId(extractionId) {
    return Array.from(this.extractedImages.values()).filter(
      (image) => image.extractionId === extractionId
    );
  }
  async getTotalExtractions() {
    return this.extractions.size;
  }
  async getTotalImages() {
    return this.extractedImages.size;
  }
  async getRecentExtractions(limit = 10) {
    return Array.from(this.extractions.values()).sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime()).slice(0, limit);
  }
  async getUsageStats() {
    const totalExtractions = await this.getTotalExtractions();
    const totalImages = await this.getTotalImages();
    const recentExtractions = await this.getRecentExtractions(5);
    return {
      totalExtractions,
      totalImages,
      recentExtractions
    };
  }
};
var storage = new MemStorage();

// shared/schema.ts
import { pgTable, text, serial, integer, timestamp, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
var extractions = pgTable("extractions", {
  id: serial("id").primaryKey(),
  url: text("url").notNull(),
  imageCount: integer("image_count").notNull().default(0),
  createdAt: timestamp("created_at").defaultNow().notNull()
});
var extractedImages = pgTable("extracted_images", {
  id: serial("id").primaryKey(),
  extractionId: integer("extraction_id").notNull(),
  url: text("url").notNull(),
  alt: text("alt"),
  width: integer("width"),
  height: integer("height"),
  fileSize: integer("file_size"),
  format: text("format"),
  isBackground: boolean("is_background").default(false),
  isLazyLoaded: boolean("is_lazy_loaded").default(false)
});
var insertExtractionSchema = createInsertSchema(extractions).pick({
  url: true
});
var insertExtractedImageSchema = createInsertSchema(extractedImages).pick({
  extractionId: true,
  url: true,
  alt: true,
  width: true,
  height: true,
  fileSize: true,
  format: true,
  isBackground: true,
  isLazyLoaded: true
});
var extractImagesRequestSchema = z.object({
  url: z.string().url("Please enter a valid URL")
});
var downloadImagesRequestSchema = z.object({
  imageUrls: z.array(z.string().url()).min(1, "At least one image must be selected")
});

// server/routes.ts
import { z as z2 } from "zod";
import puppeteer from "puppeteer";
import sharp from "sharp";
import archiver from "archiver";
import { execSync } from "child_process";
function findChromiumExecutable() {
  try {
    const chromiumPath = execSync("which chromium", { encoding: "utf-8" }).trim();
    if (chromiumPath) return chromiumPath;
  } catch (e) {
    try {
      const nixPath = execSync("find /nix/store -name chromium -type f 2>/dev/null | head -1", { encoding: "utf-8" }).trim();
      if (nixPath) return nixPath;
    } catch (e2) {
      return "";
    }
  }
  return "";
}
async function registerRoutes(app2) {
  app2.get("/api/usage", async (req, res) => {
    try {
      const stats = await storage.getUsageStats();
      res.json(stats);
    } catch (error) {
      console.error("Error fetching usage stats:", error);
      res.status(500).json({ message: "Failed to fetch usage statistics" });
    }
  });
  app2.post("/api/extract", async (req, res) => {
    try {
      const { url } = extractImagesRequestSchema.parse(req.body);
      const extraction = await storage.createExtraction({ url });
      const chromiumPath = findChromiumExecutable();
      const launchOptions = {
        headless: true,
        args: [
          "--no-sandbox",
          "--disable-setuid-sandbox",
          "--disable-dev-shm-usage",
          "--disable-gpu",
          "--disable-web-security",
          "--disable-features=VizDisplayCompositor"
        ]
      };
      if (chromiumPath) {
        launchOptions.executablePath = chromiumPath;
      }
      const browser = await puppeteer.launch(launchOptions);
      try {
        const page = await browser.newPage();
        await page.setViewport({ width: 1920, height: 1080 });
        await page.setUserAgent("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36");
        await page.goto(url, {
          waitUntil: "networkidle0",
          timeout: 3e4
        });
        await new Promise((resolve) => setTimeout(resolve, 2e3));
        const imageData = await page.evaluate(() => {
          const images = [];
          const imgElements = document.querySelectorAll("img");
          imgElements.forEach((img) => {
            if (img.src && img.src.startsWith("http")) {
              images.push({
                url: img.src,
                alt: img.alt || void 0,
                width: img.naturalWidth || void 0,
                height: img.naturalHeight || void 0,
                isBackground: false,
                isLazyLoaded: !!(img.getAttribute("loading") === "lazy" || img.dataset.src)
              });
            }
          });
          const allElements = document.querySelectorAll("*");
          allElements.forEach((el) => {
            const styles = window.getComputedStyle(el);
            const bgImage = styles.backgroundImage;
            if (bgImage && bgImage !== "none") {
              const matches = bgImage.match(/url\(["']?(.*?)["']?\)/g);
              if (matches) {
                matches.forEach((match) => {
                  const url2 = match.replace(/url\(["']?/, "").replace(/["']?\)$/, "");
                  if (url2.startsWith("http") && !images.some((img) => img.url === url2)) {
                    images.push({
                      url: url2,
                      isBackground: true,
                      isLazyLoaded: false
                    });
                  }
                });
              }
            }
          });
          return images;
        });
        const extractedImages2 = [];
        for (const imageInfo of imageData) {
          try {
            const response = await fetch(imageInfo.url);
            if (response.ok) {
              const buffer = await response.arrayBuffer();
              const imageBuffer = Buffer.from(buffer);
              let metadata;
              let format;
              try {
                metadata = await sharp(imageBuffer).metadata();
                format = metadata.format;
              } catch (e) {
                continue;
              }
              const extractedImage = await storage.createExtractedImage({
                extractionId: extraction.id,
                url: imageInfo.url,
                alt: imageInfo.alt,
                width: metadata.width,
                height: metadata.height,
                fileSize: imageBuffer.length,
                format,
                isBackground: imageInfo.isBackground,
                isLazyLoaded: imageInfo.isLazyLoaded
              });
              extractedImages2.push(extractedImage);
            }
          } catch (error) {
            console.error(`Error processing image ${imageInfo.url}:`, error);
          }
        }
        await browser.close();
        res.json({
          extraction,
          images: extractedImages2
        });
      } catch (error) {
        await browser.close();
        throw error;
      }
    } catch (error) {
      console.error("Error extracting images:", error);
      if (error instanceof z2.ZodError) {
        res.status(400).json({ message: error.errors[0].message });
      } else {
        res.status(500).json({
          message: error instanceof Error ? error.message : "Failed to extract images"
        });
      }
    }
  });
  app2.post("/api/download", async (req, res) => {
    try {
      const { imageUrls } = downloadImagesRequestSchema.parse(req.body);
      res.setHeader("Content-Type", "application/zip");
      res.setHeader("Content-Disposition", `attachment; filename="extracted-images-${Date.now()}.zip"`);
      const archive = archiver("zip", {
        zlib: { level: 9 }
      });
      archive.pipe(res);
      for (let i = 0; i < imageUrls.length; i++) {
        const imageUrl = imageUrls[i];
        try {
          const response = await fetch(imageUrl);
          if (response.ok) {
            const buffer = await response.arrayBuffer();
            const imageBuffer = Buffer.from(buffer);
            const contentType = response.headers.get("content-type");
            let extension = ".jpg";
            if (contentType?.includes("png")) extension = ".png";
            else if (contentType?.includes("gif")) extension = ".gif";
            else if (contentType?.includes("webp")) extension = ".webp";
            else if (contentType?.includes("svg")) extension = ".svg";
            else {
              const urlExtension = imageUrl.split(".").pop()?.toLowerCase();
              if (urlExtension && ["jpg", "jpeg", "png", "gif", "webp", "svg"].includes(urlExtension)) {
                extension = "." + urlExtension;
              }
            }
            const filename = `image-${i + 1}${extension}`;
            archive.append(imageBuffer, { name: filename });
          }
        } catch (error) {
          console.error(`Error downloading image ${imageUrl}:`, error);
        }
      }
      await archive.finalize();
    } catch (error) {
      console.error("Error creating ZIP:", error);
      if (error instanceof z2.ZodError) {
        res.status(400).json({ message: error.errors[0].message });
      } else {
        res.status(500).json({
          message: error instanceof Error ? error.message : "Failed to create download"
        });
      }
    }
  });
  const httpServer = createServer(app2);
  return httpServer;
}

// server/vite.ts
import express from "express";
import fs from "fs";
import path2 from "path";
import { createServer as createViteServer, createLogger } from "vite";

// vite.config.ts
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";
import runtimeErrorOverlay from "@replit/vite-plugin-runtime-error-modal";
var vite_config_default = defineConfig({
  plugins: [
    react(),
    runtimeErrorOverlay(),
    ...process.env.NODE_ENV !== "production" && process.env.REPL_ID !== void 0 ? [
      await import("@replit/vite-plugin-cartographer").then(
        (m) => m.cartographer()
      )
    ] : []
  ],
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "client", "src"),
      "@shared": path.resolve(import.meta.dirname, "shared"),
      "@assets": path.resolve(import.meta.dirname, "attached_assets")
    }
  },
  root: path.resolve(import.meta.dirname, "client"),
  build: {
    outDir: path.resolve(import.meta.dirname, "dist/public"),
    emptyOutDir: true
  },
  server: {
    fs: {
      strict: true,
      deny: ["**/.*"]
    }
  }
});

// server/vite.ts
import { nanoid } from "nanoid";
var viteLogger = createLogger();
function log(message, source = "express") {
  const formattedTime = (/* @__PURE__ */ new Date()).toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true
  });
  console.log(`${formattedTime} [${source}] ${message}`);
}
async function setupVite(app2, server) {
  const serverOptions = {
    middlewareMode: true,
    hmr: { server },
    allowedHosts: true
  };
  const vite = await createViteServer({
    ...vite_config_default,
    configFile: false,
    customLogger: {
      ...viteLogger,
      error: (msg, options) => {
        viteLogger.error(msg, options);
        process.exit(1);
      }
    },
    server: serverOptions,
    appType: "custom"
  });
  app2.use(vite.middlewares);
  app2.use("*", async (req, res, next) => {
    const url = req.originalUrl;
    try {
      const clientTemplate = path2.resolve(
        import.meta.dirname,
        "..",
        "client",
        "index.html"
      );
      let template = await fs.promises.readFile(clientTemplate, "utf-8");
      template = template.replace(
        `src="/src/main.tsx"`,
        `src="/src/main.tsx?v=${nanoid()}"`
      );
      const page = await vite.transformIndexHtml(url, template);
      res.status(200).set({ "Content-Type": "text/html" }).end(page);
    } catch (e) {
      vite.ssrFixStacktrace(e);
      next(e);
    }
  });
}
function serveStatic(app2) {
  const distPath = path2.resolve(import.meta.dirname, "public");
  if (!fs.existsSync(distPath)) {
    throw new Error(
      `Could not find the build directory: ${distPath}, make sure to build the client first`
    );
  }
  app2.use(express.static(distPath));
  app2.use("*", (_req, res) => {
    res.sendFile(path2.resolve(distPath, "index.html"));
  });
}

// server/index.ts
var app = express2();
app.use(express2.json());
app.use(express2.urlencoded({ extended: false }));
app.use((req, res, next) => {
  const start = Date.now();
  const path3 = req.path;
  let capturedJsonResponse = void 0;
  const originalResJson = res.json;
  res.json = function(bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };
  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path3.startsWith("/api")) {
      let logLine = `${req.method} ${path3} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }
      if (logLine.length > 80) {
        logLine = logLine.slice(0, 79) + "\u2026";
      }
      log(logLine);
    }
  });
  next();
});
(async () => {
  const server = await registerRoutes(app);
  app.use((err, _req, res, _next) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";
    res.status(status).json({ message });
    throw err;
  });
  if (app.get("env") === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }
  const port = 5e3;
  server.listen({
    port,
    host: "0.0.0.0",
    reusePort: true
  }, () => {
    log(`serving on port ${port}`);
  });
})();
