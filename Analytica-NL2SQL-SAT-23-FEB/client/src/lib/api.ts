import { useMutation, useQuery } from '@tanstack/react-query';

export function useCalculate() {
  return useMutation({
    mutationFn: async (data: any) => {
      const response = await fetch('/api/calculate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      });
      
      if (!response.ok) {
        throw new Error('Calculation failed');
      }
      
      return response.json();
    },
  });
}

export function useLoadData() {
  return useQuery({
    queryKey: ['/api/data'],
  });
}

export function useSaveData() {
  return useMutation({
    mutationFn: async (data: any) => {
      const response = await fetch('/api/data', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      });
      
      if (!response.ok) {
        throw new Error('Failed to save data');
      }
      
      return response.json();
    },
  });
}
