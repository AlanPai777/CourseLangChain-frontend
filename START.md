# Getting Started

## Prerequisites

- Node.js 20.x
- pnpm

## Installation

Install Node.js (if not already installed):

```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | bash - && apt-get install -y nodejs
```

Install pnpm (if not already installed):

```bash
curl -fsSL https://get.pnpm.io/install.sh | sh -
source /root/.bashrc
```

Install dependencies:

```bash
pnpm install
```

## Running the Frontend

Start the development server:

```bash
pnpm run dev
```

The app will be available at http://localhost:3000/

## Notes

- If pnpm-lock.yaml is incompatible with your pnpm version, delete it and run `pnpm install` to regenerate.
- After installing, run `pnpm add -D vue-tsc@latest` to ensure compatibility with TypeScript.

- `pnpm run dev` - Start development server (port 3000)
- `pnpm run build` - Build for production
- `pnpm run preview` - Preview production build
