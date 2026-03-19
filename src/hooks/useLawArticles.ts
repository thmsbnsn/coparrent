import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export interface LawArticle {
  id: string;
  article_number: string;
  slug: string;
  title: string;
  summary: string | null;
  related_slugs: string[] | null;
  storage_path: string;
  access_level: string;
  is_repealed: boolean;
  created_at: string;
  updated_at: string;
}

export const useLawArticles = () => {
  return useQuery({
    queryKey: ['law-articles'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('law_articles')
        .select('*')
        .order('article_number', { ascending: true });

      if (error) throw error;
      return data as LawArticle[];
    },
  });
};

export const useLawArticle = (slug: string) => {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['law-article', slug],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('law_articles')
        .select('*')
        .eq('slug', slug)
        .single();

      if (error) throw error;
      return data as LawArticle;
    },
    enabled: !!slug,
  });
};

export const useRelatedArticles = (slugs: string[] | null) => {
  return useQuery({
    queryKey: ['related-articles', slugs],
    queryFn: async () => {
      if (!slugs || slugs.length === 0) return [];
      
      const { data, error } = await supabase
        .from('law_articles')
        .select('id, article_number, slug, title, summary, is_repealed, access_level')
        .in('slug', slugs);

      if (error) throw error;
      return data as LawArticle[];
    },
    enabled: !!slugs && slugs.length > 0,
  });
};

export const useLawArticleMarkdown = (storagePath: string | null, accessLevel: string) => {
  const { user } = useAuth();
  const canAccess = accessLevel !== 'auth' || !!user;

  return useQuery({
    queryKey: ['law-article-markdown', storagePath],
    queryFn: async () => {
      if (!storagePath) throw new Error('No storage path provided');
      
      // Try signed URL first for more reliable access
      const { data: signedData, error: signedError } = await supabase.storage
        .from('law-library')
        .createSignedUrl(storagePath, 3600);

      let url: string;
      if (signedError) {
        // Fallback to public URL
        const { data: publicData } = supabase.storage
          .from('law-library')
          .getPublicUrl(storagePath);
        url = publicData.publicUrl;
      } else {
        url = signedData.signedUrl;
      }

      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`Failed to fetch markdown: ${response.statusText}`);
      }
      
      return response.text();
    },
    enabled: !!storagePath && canAccess,
  });
};
