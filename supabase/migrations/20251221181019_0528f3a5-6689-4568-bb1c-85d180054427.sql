-- Create storage bucket for receipts
INSERT INTO storage.buckets (id, name, public)
VALUES ('receipts', 'receipts', false);

-- Storage policies for receipts bucket
CREATE POLICY "Users can upload their own receipts"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'receipts' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can view receipts for shared expenses"
ON storage.objects FOR SELECT
USING (bucket_id = 'receipts');

CREATE POLICY "Users can delete their own receipts"
ON storage.objects FOR DELETE
USING (bucket_id = 'receipts' AND auth.uid()::text = (storage.foldername(name))[1]);

-- Expenses table
CREATE TABLE public.expenses (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  created_by UUID NOT NULL,
  child_id UUID REFERENCES public.children(id) ON DELETE SET NULL,
  category TEXT NOT NULL DEFAULT 'other',
  amount DECIMAL(10,2) NOT NULL CHECK (amount > 0),
  description TEXT NOT NULL,
  expense_date DATE NOT NULL DEFAULT CURRENT_DATE,
  receipt_path TEXT,
  split_percentage DECIMAL(5,2) DEFAULT 50.00 CHECK (split_percentage >= 0 AND split_percentage <= 100),
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  CONSTRAINT fk_created_by FOREIGN KEY (created_by) REFERENCES public.profiles(id) ON DELETE CASCADE
);

-- Reimbursement requests table
CREATE TABLE public.reimbursement_requests (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  expense_id UUID NOT NULL REFERENCES public.expenses(id) ON DELETE CASCADE,
  requester_id UUID NOT NULL,
  recipient_id UUID NOT NULL,
  amount DECIMAL(10,2) NOT NULL CHECK (amount > 0),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'paid')),
  message TEXT,
  response_message TEXT,
  responded_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  CONSTRAINT fk_requester FOREIGN KEY (requester_id) REFERENCES public.profiles(id) ON DELETE CASCADE,
  CONSTRAINT fk_recipient FOREIGN KEY (recipient_id) REFERENCES public.profiles(id) ON DELETE CASCADE
);

-- Enable RLS
ALTER TABLE public.expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reimbursement_requests ENABLE ROW LEVEL SECURITY;

-- Expenses RLS - both co-parents can see shared expenses
CREATE POLICY "Users can view their expenses and co-parent expenses"
ON public.expenses FOR SELECT
USING (
  created_by IN (
    SELECT id FROM profiles WHERE user_id = auth.uid()
  ) OR
  created_by IN (
    SELECT co_parent_id FROM profiles WHERE user_id = auth.uid() AND co_parent_id IS NOT NULL
  ) OR
  created_by IN (
    SELECT id FROM profiles WHERE co_parent_id IN (
      SELECT id FROM profiles WHERE user_id = auth.uid()
    )
  )
);

CREATE POLICY "Users can create their own expenses"
ON public.expenses FOR INSERT
WITH CHECK (created_by IN (SELECT id FROM profiles WHERE user_id = auth.uid()));

CREATE POLICY "Users can update their own expenses"
ON public.expenses FOR UPDATE
USING (created_by IN (SELECT id FROM profiles WHERE user_id = auth.uid()));

CREATE POLICY "Users can delete their own expenses"
ON public.expenses FOR DELETE
USING (created_by IN (SELECT id FROM profiles WHERE user_id = auth.uid()));

-- Reimbursement requests RLS
CREATE POLICY "Users can view their reimbursement requests"
ON public.reimbursement_requests FOR SELECT
USING (
  requester_id IN (SELECT id FROM profiles WHERE user_id = auth.uid()) OR
  recipient_id IN (SELECT id FROM profiles WHERE user_id = auth.uid())
);

CREATE POLICY "Users can create reimbursement requests"
ON public.reimbursement_requests FOR INSERT
WITH CHECK (requester_id IN (SELECT id FROM profiles WHERE user_id = auth.uid()));

CREATE POLICY "Recipients can update reimbursement requests"
ON public.reimbursement_requests FOR UPDATE
USING (recipient_id IN (SELECT id FROM profiles WHERE user_id = auth.uid()));

-- Triggers for updated_at
CREATE TRIGGER update_expenses_updated_at
BEFORE UPDATE ON public.expenses
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_reimbursement_requests_updated_at
BEFORE UPDATE ON public.reimbursement_requests
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();