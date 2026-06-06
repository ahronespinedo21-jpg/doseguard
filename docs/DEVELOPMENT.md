# DoseGuard Medication Reminder App - Running the Project

## ✅ Project Status
- **Framework**: Angular 18 + Ionic Framework  
- **Build Status**: ✅ Passing
- **Development Server**: ✅ Running on http://localhost:8100

## How to Run the Project

### Option 1: Using npm (Recommended)
```bash
npm run ionic
```
This starts the development server on **http://localhost:8100** with hot-reload enabled.

### Option 2: Using included wrapper scripts
PowerShell:
```powershell
.\ionic.ps1 serve
```

Command Prompt:
```cmd
ionic.bat serve
```

### Option 3: Direct ng serve command
```bash
ng serve --port 8100 --open
```

## Available npm Scripts
```bash
npm run build    # Production build
npm run dev      # Development server on port 4200 (auto-open browser)
npm run ionic    # Development server on port 8100 (auto-open browser)
npm run watch    # Build in watch mode
npm test         # Run tests
npm lint         # Run linter
```

## Project Structure
- **Angular Components**: All proper structure with separate .ts, .html, and .css files
- **Services**: Authentication and Medication management with RxJS
- **Routing**: 15+ routes for user and admin pages
- **Styling**: Tailwind CSS + Ionic CSS theming

## Features
✅ User login/signup with email validation  
✅ Admin dashboard and management pages  
✅ Medication tracking and adherence  
✅ Chatbot integration  
✅ Mobile-responsive design with Ionic  
✅ PWA support with Capacitor  

## Build Information
- Initial bundle: 5.99 MB (dev) / 1.11 MB (prod)
- Lazy chunks: 5 bundle files
- Build time: ~48 seconds (dev), varies for production

## Notes
- The project uses `--legacy-peer-deps` flag for npm installations due to dependency compatibility
- Ionic CLI direct command (`ionic serve`) has compatibility issues with Angular 18, use `npm run ionic` instead
- Hot module reloading enabled for instant development feedback
