# Image Extractor - Production Deployment

A modern web application for extracting and downloading images from any webpage using Puppeteer and React.

## Features

- Extract all images from any public webpage URL
- Support for IMG tags, CSS backgrounds, lazy-loaded images
- Interactive image gallery with selection controls
- Bulk download as ZIP archives
- Real-time usage statistics
- Mobile-friendly responsive design

## Deployment Instructions for Hostinger

### Prerequisites

1. **Node.js hosting plan**: Ensure your Hostinger plan supports Node.js applications
2. **Node.js version**: Requires Node.js 18+ (check with your hosting provider)

### Step 1: Upload Files

1. Download this entire `dist` folder as a ZIP file
2. Extract the contents to your Hostinger file manager or upload via FTP
3. Upload all files to your domain's public folder (usually `public_html` or `www`)

### Step 2: Install Dependencies

Connect to your hosting via SSH or use Hostinger's terminal and run:

```bash
npm install --production
```

### Step 3: Environment Variables

Create a `.env` file in your root directory with the following:

```env
# Required for production
NODE_ENV=production
PORT=3000

# Optional: PostgreSQL Database (if you want persistent storage)
# DATABASE_URL=postgresql://username:password@localhost:5432/database_name

# Session Secret (generate a random string)
SESSION_SECRET=your-super-secret-random-string-here
```

### Step 4: Start the Application

```bash
npm start
```

### Step 5: Domain Configuration

1. Configure your domain to point to the application
2. If using a subdomain, update DNS settings in Hostinger control panel
3. The application will be available at your domain

## File Structure

```
dist/
├── index.js           # Server application
├── package.json       # Production dependencies
├── public/           # Static frontend files
│   ├── index.html    # Main HTML file
│   └── assets/       # CSS and JS bundles
└── README.md         # This file
```

## Troubleshooting

### Common Issues

1. **Permission errors**: Ensure Node.js has write permissions for temporary files
2. **Port conflicts**: Update PORT in .env file if 3000 is taken
3. **Memory issues**: Puppeteer may require additional memory allocation

### Browser Dependencies

The application uses Puppeteer for web scraping. If you encounter browser-related errors:

1. Check if Chromium is available on your server
2. You may need to install additional dependencies:
   ```bash
   # On Ubuntu/Debian servers
   sudo apt-get update
   sudo apt-get install -y chromium-browser
   ```

### Performance Optimization

1. **Memory**: Set Puppeteer args for limited memory environments
2. **CPU**: Consider limiting concurrent extractions for shared hosting
3. **Storage**: Regular cleanup of temporary files may be needed

## Support

For deployment issues specific to Hostinger:
1. Check Hostinger's Node.js documentation
2. Contact Hostinger support for server-specific requirements
3. Ensure your hosting plan supports the required Node.js version

## Security Notes

- Never expose your SESSION_SECRET
- Consider adding rate limiting for production use
- Regularly update dependencies for security patches

---

**Built with**: React, Express.js, Puppeteer, Tailwind CSS
**Version**: 1.0.0