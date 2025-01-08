import { createStandaloneToast } from '@chakra-ui/toast';

const { toast } = createStandaloneToast();

interface SnackbarOptions {
  variant?: 'success' | 'error' | 'warning' | 'info';
  duration?: number;
}

export const enqueueSnackbar = (message: string, options: SnackbarOptions = {}) => {
  const { variant = 'info', duration = 5000 } = options;
  
  const status = variant === 'error' ? 'error' :
                 variant === 'success' ? 'success' :
                 variant === 'warning' ? 'warning' : 'info';

  toast({
    title: message,
    status,
    duration,
    isClosable: true,
    position: 'top'
  });
};
