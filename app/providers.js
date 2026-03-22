'use client';
import { Children, cloneElement, isValidElement } from 'react';
import { PrivyProvider } from '@privy-io/react-auth';

export default function Providers({ children }) {
  return (
    <PrivyProvider
      appId={process.env.NEXT_PUBLIC_PRIVY_APP_ID}
      config={{
        loginMethods: ['wallet', 'email', 'google', 'twitter'],
        appearance: {
          theme: 'dark',
          accentColor: '#00C2FF',
        },
        embeddedWallets: {
          createOnLogin: 'users-without-wallets',
        },
      }}
    >
      {Children.map(children, (child, index) => {
        if (isValidElement(child)) {
          return cloneElement(child, { key: child.key ?? index });
        }
        return child;
      })}
    </PrivyProvider>
  );
}
