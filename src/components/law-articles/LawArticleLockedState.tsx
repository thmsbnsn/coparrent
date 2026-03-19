import { Lock, LogIn } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

export const LawArticleLockedState = () => {
  return (
    <Card className="border-dashed border-2">
      <CardContent className="flex flex-col items-center justify-center py-12 text-center">
        <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
          <Lock className="w-8 h-8 text-muted-foreground" />
        </div>
        <h3 className="text-lg font-semibold text-foreground mb-2">
          Authentication Required
        </h3>
        <p className="text-sm text-muted-foreground max-w-md mb-6">
          This statute content requires authentication to view. Please sign in to access the full text.
        </p>
        <Button asChild>
          <Link to="/login">
            <LogIn className="w-4 h-4 mr-2" />
            Sign In to View
          </Link>
        </Button>
      </CardContent>
    </Card>
  );
};
