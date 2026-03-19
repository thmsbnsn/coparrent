import { Link } from 'react-router-dom';
import { Lock, AlertTriangle, ArrowRight } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import type { LawArticle } from '@/hooks/useLawArticles';

interface RelatedArticleCardProps {
  article: LawArticle;
}

export const RelatedArticleCard = ({ article }: RelatedArticleCardProps) => {
  return (
    <Link to={`/dashboard/law-library/${article.slug}`}>
      <Card className="h-full hover:shadow-md transition-all cursor-pointer border-border hover:border-primary/30 group">
        <CardContent className="p-4">
          <div className="flex items-start justify-between gap-2 mb-2">
            <span className="text-xs font-medium text-muted-foreground">
              Article {article.article_number}
            </span>
            <div className="flex items-center gap-1">
              {article.access_level === 'auth' && (
                <Lock className="w-3 h-3 text-muted-foreground" />
              )}
              {article.is_repealed && (
                <AlertTriangle className="w-3 h-3 text-destructive" />
              )}
            </div>
          </div>
          <h4 className="text-sm font-medium text-foreground line-clamp-2 group-hover:text-primary transition-colors">
            {article.title}
          </h4>
          <div className="flex items-center gap-1 mt-2 text-xs text-primary opacity-0 group-hover:opacity-100 transition-opacity">
            <span>View article</span>
            <ArrowRight className="w-3 h-3" />
          </div>
        </CardContent>
      </Card>
    </Link>
  );
};
