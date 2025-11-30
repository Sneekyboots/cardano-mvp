# Yield Safe Frontend

A React-based frontend for the Yield Safe impermanent loss protection protocol on Cardano.

## Quick Start

### Prerequisites
- Node.js (v18+)
- npm or yarn

### Installation & Run

```bash
# Install dependencies
npm install

# Start development server
npm run dev
```

The application will be available at `http://localhost:5173`

## Available Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run preview` - Preview production build
- `npm run lint` - Run ESLint
- `npm run test` - Run tests
- `npm run test:ui` - Run tests with UI

## Tech Stack

- **React 18** - UI framework
- **TypeScript** - Type safety
- **Vite** - Build tool
- **Tailwind CSS** - Styling
- **React Router** - Navigation
- **Lucid Cardano** - Cardano blockchain integration
- **React Query** - Data fetching & caching
- **Recharts** - Charts & visualization

## Project Structure

```
src/
├── components/     # Reusable UI components
├── contexts/       # React contexts
├── pages/          # Page components
├── lib/            # Utilities & helpers
├── providers/      # Context providers
├── App.tsx         # Main app component
└── main.tsx        # Entry point
```

## Features

- Vault management for yield farming
- Impermanent loss monitoring
- Pool selection and interaction
- Wallet integration via Lucid Cardano

## Development

The frontend uses Vite for fast development and HMR (Hot Module Replacement). Make changes to files and they'll hot-reload instantly.

## Building

```bash
npm run build
```

This creates an optimized production build in the `dist/` folder.
