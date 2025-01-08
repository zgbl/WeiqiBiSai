import React from 'react';
import { SnackbarProvider as NotistackProvider } from 'notistack';

const SnackbarProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  return (
    <NotistackProvider
      maxSnack={3}
      anchorOrigin={{
        vertical: 'bottom',
        horizontal: 'right',
      }}
      autoHideDuration={3000}
    >
      {children}
    </NotistackProvider>
  );
};

export default SnackbarProvider;
