import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from '@/lib/api';

export interface Product {
  id: string;
  tenant_id: string;
  name: string;
  description: string | null;
  usp: string | null;
  price: string | null;
  image_url: string | null;
  status: 'active' | 'discontinued';
  created_by: string;
  created_at: string;
  updated_at: string;
}

export type ProductInput = Partial<Pick<Product, 'name' | 'description' | 'usp' | 'price' | 'image_url' | 'status'>>;

const productKeys = {
  all: () => ['products'] as const,
};

export function useProducts(enabled = true) {
  return useQuery<Product[]>({
    queryKey: productKeys.all(),
    queryFn: () => apiFetch('/products.php'),
    staleTime: 30_000,
    enabled,
  });
}

export function useCreateProduct() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: ProductInput) =>
      apiFetch('/products.php', { method: 'POST', body: JSON.stringify(payload) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: productKeys.all() }),
  });
}

export function useUpdateProduct() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...payload }: ProductInput & { id: string }) =>
      apiFetch(`/products.php?id=${id}`, { method: 'PUT', body: JSON.stringify(payload) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: productKeys.all() }),
  });
}

export function useDeleteProduct() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiFetch(`/products.php?id=${id}`, { method: 'DELETE' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: productKeys.all() }),
  });
}
