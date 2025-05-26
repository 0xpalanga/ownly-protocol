# Ownly Frontend

A decentralized application for secure token management on the Sui blockchain.

## Deployment Steps

1. **Prepare Your Repository**
   ```bash
   git init
   git add .
   git commit -m "Initial commit"
   ```

2. **Create a GitHub Repository**
   - Go to GitHub.com
   - Create a new repository
   - Push your code:
   ```bash
   git remote add origin your-github-repo-url
   git push -u origin main
   ```

3. **Deploy to Vercel**
   - Go to [vercel.com](https://vercel.com)
   - Sign up/Login with GitHub
   - Click "New Project"
   - Import your GitHub repository
   - Add these environment variables:
     ```
     NEXT_PUBLIC_SUI_NETWORK=testnet
     NEXT_PUBLIC_PACKAGE_ID=your_package_id_here
     NEXT_PUBLIC_FIREBASE_API_KEY=your_firebase_api_key
     NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your_firebase_auth_domain
     NEXT_PUBLIC_FIREBASE_PROJECT_ID=your_firebase_project_id
     NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your_firebase_storage_bucket
     NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=your_firebase_messaging_sender_id
     NEXT_PUBLIC_FIREBASE_APP_ID=your_firebase_app_id
     ```
   - Click "Deploy"

4. **After Deployment**
   - Your app will be available at: `https://your-project-name.vercel.app`
   - Set up a custom domain if needed through Vercel's dashboard

## Local Development
```bash
# Install dependencies
npm install

# Create .env.local file with the above environment variables

# Run development server
npm run dev
```

## Technology Stack
- Next.js 13+
- React 18
- Sui SDK
- Firebase
- TailwindCSS
- TypeScript

## Features

- Support for multiple tokens on Sui testnet ($SUI, $WAL, $DEEP, $NS)
- Secure token encryption and locking using Sui Move smart contracts
- Token transfer with recipient-specific encryption
- Real-time transaction history and balance tracking
- Firebase authentication and secure wallet management
- Comprehensive security rules for data protection

## Prerequisites

- Node.js 16.x or later
- Sui CLI and SDK
- Firebase account and project
- Sui wallet with testnet tokens

## Installation

1. Clone the repository:
```bash
git clone https://github.com/your-username/ownly-frontend.git
cd ownly-frontend
```

2. Install dependencies:
```bash
npm install
```

3. Set up environment variables:
Create a `.env.local` file in the root directory with the following variables:
```env
NEXT_PUBLIC_FIREBASE_API_KEY=your_firebase_api_key
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your_firebase_auth_domain
NEXT_PUBLIC_FIREBASE_PROJECT_ID=your_firebase_project_id
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your_firebase_storage_bucket
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=your_firebase_messaging_sender_id
NEXT_PUBLIC_FIREBASE_APP_ID=your_firebase_app_id
NEXT_PUBLIC_PACKAGE_ID=your_sui_package_id
```

4. Deploy the Sui Move package:
```bash
cd src/ownly-protocol
sui client publish --gas-budget 100000000
```
Note the package ID and update it in your `.env.local` file.

5. Update Firebase security rules:
Copy the contents of `firestore.rules` to your Firebase Console's Security Rules section.

## Development

Run the development server:
```bash
npm run dev
```

## Smart Contract Deployment

The Sui Move package needs to be deployed to the Sui testnet. Follow these steps:

1. Build the package:
```bash
sui move build
```

2. Deploy to testnet:
```bash
sui client publish --gas-budget 100000000
```

3. Update the package ID in your `.env.local` file.

## Token Support

The protocol currently supports the following tokens on Sui testnet:

- $SUI (Native Sui token)
- $WAL (Wallet Token)
- $DEEP (Deep Token)
- $NS (Name Service Token)

To add support for additional tokens:

1. Add the token information to `src/lib/tokens.ts`
2. Update the token type in the Move smart contract
3. Deploy the updated contract

## Security

The protocol implements several security measures:

- Firebase Authentication for user management
- Secure wallet information storage
- Encrypted token data
- Smart contract security checks
- Comprehensive Firebase security rules

## Architecture

The protocol consists of three main components:

1. Frontend (Next.js + React)
2. Smart Contracts (Sui Move)
3. Backend (Firebase)

### Frontend
- Built with Next.js 13+ and React
- Uses @mysten/dapp-kit for Sui wallet integration
- Implements real-time updates with Firebase
- Responsive UI with Tailwind CSS

### Smart Contracts
- Token locking and unlocking functionality
- Secure token transfer mechanisms
- Event emission for transaction tracking
- Type-safe token operations

### Backend
- Firebase Authentication
- Firestore for data storage
- Real-time updates
- Secure data access rules

## Contributing

1. Fork the repository
2. Create your feature branch
3. Commit your changes
4. Push to the branch
5. Create a new Pull Request

## License

MIT License
