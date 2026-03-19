import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export interface LawLibraryResource {
  id: string;
  title: string;
  description: string | null;
  state: string;
  category: string;
  file_name: string;
  file_path: string;
  file_size: number;
  file_type: string;
  source_url: string | null;
  last_verified_at: string;
  created_at: string;
  updated_at: string;
}

export const US_STATES = [
  { value: 'all', label: 'All States' },
  { value: 'AL', label: 'Alabama' },
  { value: 'AK', label: 'Alaska' },
  { value: 'AZ', label: 'Arizona' },
  { value: 'AR', label: 'Arkansas' },
  { value: 'CA', label: 'California' },
  { value: 'CO', label: 'Colorado' },
  { value: 'CT', label: 'Connecticut' },
  { value: 'DE', label: 'Delaware' },
  { value: 'FL', label: 'Florida' },
  { value: 'GA', label: 'Georgia' },
  { value: 'HI', label: 'Hawaii' },
  { value: 'ID', label: 'Idaho' },
  { value: 'IL', label: 'Illinois' },
  { value: 'IN', label: 'Indiana' },
  { value: 'IA', label: 'Iowa' },
  { value: 'KS', label: 'Kansas' },
  { value: 'KY', label: 'Kentucky' },
  { value: 'LA', label: 'Louisiana' },
  { value: 'ME', label: 'Maine' },
  { value: 'MD', label: 'Maryland' },
  { value: 'MA', label: 'Massachusetts' },
  { value: 'MI', label: 'Michigan' },
  { value: 'MN', label: 'Minnesota' },
  { value: 'MS', label: 'Mississippi' },
  { value: 'MO', label: 'Missouri' },
  { value: 'MT', label: 'Montana' },
  { value: 'NE', label: 'Nebraska' },
  { value: 'NV', label: 'Nevada' },
  { value: 'NH', label: 'New Hampshire' },
  { value: 'NJ', label: 'New Jersey' },
  { value: 'NM', label: 'New Mexico' },
  { value: 'NY', label: 'New York' },
  { value: 'NC', label: 'North Carolina' },
  { value: 'ND', label: 'North Dakota' },
  { value: 'OH', label: 'Ohio' },
  { value: 'OK', label: 'Oklahoma' },
  { value: 'OR', label: 'Oregon' },
  { value: 'PA', label: 'Pennsylvania' },
  { value: 'RI', label: 'Rhode Island' },
  { value: 'SC', label: 'South Carolina' },
  { value: 'SD', label: 'South Dakota' },
  { value: 'TN', label: 'Tennessee' },
  { value: 'TX', label: 'Texas' },
  { value: 'UT', label: 'Utah' },
  { value: 'VT', label: 'Vermont' },
  { value: 'VA', label: 'Virginia' },
  { value: 'WA', label: 'Washington' },
  { value: 'WV', label: 'West Virginia' },
  { value: 'WI', label: 'Wisconsin' },
  { value: 'WY', label: 'Wyoming' },
  { value: 'DC', label: 'District of Columbia' },
  { value: 'federal', label: 'Federal' },
];

export const RESOURCE_CATEGORIES = [
  { value: 'all', label: 'All Topics' },
  { value: 'parenting-time', label: 'Parenting Time Guidelines' },
  { value: 'custody', label: 'Custody Laws' },
  { value: 'child-support', label: 'Child Support' },
  { value: 'visitation', label: 'Visitation Rights' },
  { value: 'relocation', label: 'Relocation Laws' },
  { value: 'modification', label: 'Modification of Orders' },
  { value: 'domestic-violence', label: 'Domestic Violence' },
  { value: 'general', label: 'General Family Law' },
];

export const useLawLibrary = () => {
  const [resources, setResources] = useState<LawLibraryResource[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  const fetchResources = useCallback(async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('law_library_resources')
        .select('*')
        .order('state', { ascending: true })
        .order('title', { ascending: true });

      if (error) throw error;
      setResources((data as LawLibraryResource[]) || []);
    } catch (error: unknown) {
      console.error('Error fetching law library resources:', error);
      toast({
        title: 'Error',
        description: 'Failed to load law library resources.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  const getPublicUrl = (filePath: string) => {
    const { data } = supabase.storage
      .from('law-library')
      .getPublicUrl(filePath);
    return data.publicUrl;
  };

  const viewResource = async (resource: LawLibraryResource) => {
    try {
      // Use signed URL for more reliable access
      const { data, error } = await supabase.storage
        .from('law-library')
        .createSignedUrl(resource.file_path, 3600); // 1 hour expiry

      if (error) {
        console.error('Error creating signed URL:', error);
        // Fallback to public URL
        const publicUrl = getPublicUrl(resource.file_path);
        window.open(publicUrl, '_blank', 'noopener,noreferrer');
        return;
      }

      window.open(data.signedUrl, '_blank', 'noopener,noreferrer');
    } catch (error) {
      console.error('Error viewing resource:', error);
      toast({
        title: 'Error',
        description: 'Could not open the document.',
        variant: 'destructive',
      });
    }
  };

  const downloadResource = async (resource: LawLibraryResource) => {
    try {
      const { data, error } = await supabase.storage
        .from('law-library')
        .download(resource.file_path);

      if (error) throw error;

      const url = URL.createObjectURL(data);
      const a = document.createElement('a');
      a.href = url;
      a.download = resource.file_name;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      toast({
        title: 'Download Started',
        description: `Downloading ${resource.file_name}`,
      });
    } catch (error: unknown) {
      console.error('Error downloading resource:', error);
      toast({
        title: 'Download Failed',
        description: 'Could not download the document.',
        variant: 'destructive',
      });
    }
  };

  useEffect(() => {
    void fetchResources();
  }, [fetchResources]);

  return {
    resources,
    loading,
    fetchResources,
    viewResource,
    downloadResource,
    getPublicUrl,
  };
};
