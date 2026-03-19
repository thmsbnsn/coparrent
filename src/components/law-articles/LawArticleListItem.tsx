import { Link } from 'react-router-dom';
import { Lock, AlertTriangle } from 'lucide-react';
import { motion } from 'framer-motion';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { LawArticle } from '@/hooks/useLawArticles';

interface LawArticleListItemProps {
  article: LawArticle;
  index: number;
}

export const LawArticleListItem = ({ article, index }: LawArticleListItemProps) => {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: index * 0.03 }}
    >
      <Link to={`/dashboard/law-library/${article.slug}`}>
        <Card className="h-full hover:shadow-md transition-shadow cursor-pointer border-border hover:border-primary/30">
          <CardHeader className="pb-2">
            <div className="flex items-start justify-between gap-2">
              <CardTitle className="text-base font-semibold leading-tight">
                Article {article.article_number}
              </CardTitle>
              <div className="flex items-center gap-1.5 flex-shrink-0">
                {article.access_level === 'auth' && (
                  <Badge variant="secondary" className="gap-1 text-xs">
                    <Lock className="w-3 h-3" />
                    Auth
                  </Badge>
                )}
                {article.is_repealed && (
                  <Badge variant="destructive" className="gap-1 text-xs">
                    <AlertTriangle className="w-3 h-3" />
                    Repealed
                  </Badge>
                )}
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <h3 className="text-sm font-medium text-foreground mb-2 line-clamp-2">
              {article.title}
            </h3>
            {article.summary && (
              <p className="text-sm text-muted-foreground line-clamp-3">
                {article.summary}
              </p>
            )}
          </CardContent>
        </Card>
      </Link>
    </motion.div>
  );
};
