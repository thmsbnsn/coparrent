import { useState } from 'react';
import { ChevronDown, ChevronUp, List } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { TocHeading } from './MarkdownRenderer';

interface TableOfContentsProps {
  headings: TocHeading[];
  className?: string;
}

export const TableOfContents = ({ headings, className }: TableOfContentsProps) => {
  const [isOpen, setIsOpen] = useState(false);

  const scrollToHeading = (id: string) => {
    const element = document.getElementById(id);
    if (element) {
      const headerOffset = 80; // Offset for fixed header
      const elementPosition = element.getBoundingClientRect().top;
      const offsetPosition = elementPosition + window.scrollY - headerOffset;

      window.scrollTo({
        top: offsetPosition,
        behavior: 'smooth',
      });
    }
    setIsOpen(false); // Close mobile TOC after click
  };

  const handleKeyDown = (e: React.KeyboardEvent, id: string) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      scrollToHeading(id);
    }
  };

  if (headings.length === 0) return null;

  // Desktop: Sticky sidebar
  const DesktopToc = (
    <Card className="hidden lg:block sticky top-20 max-h-[calc(100vh-6rem)] overflow-y-auto">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          <List className="w-4 h-4" aria-hidden="true" />
          Table of Contents
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-0">
        <nav aria-label="Table of contents" className="space-y-1">
          {headings.map((heading) => (
            <button
              key={heading.id}
              onClick={() => scrollToHeading(heading.id)}
              onKeyDown={(e) => handleKeyDown(e, heading.id)}
              className={cn(
                'block w-full text-left text-sm py-1.5 px-2 rounded-md transition-colors',
                'text-muted-foreground hover:text-foreground hover:bg-muted',
                'focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1',
                heading.level === 3 && 'pl-4'
              )}
              aria-label={`Jump to ${heading.text}`}
            >
              {heading.text}
            </button>
          ))}
        </nav>
      </CardContent>
    </Card>
  );

  // Mobile: Collapsible section
  const MobileToc = (
    <Collapsible open={isOpen} onOpenChange={setIsOpen} className="lg:hidden">
      <Card className="mb-4">
        <CollapsibleTrigger asChild>
          <Button 
            variant="ghost" 
            className="w-full justify-between p-4 h-auto"
            aria-expanded={isOpen}
            aria-controls="mobile-toc-content"
          >
            <span className="flex items-center gap-2 text-sm font-medium">
              <List className="w-4 h-4" aria-hidden="true" />
              Table of Contents ({headings.length})
            </span>
            {isOpen ? (
              <ChevronUp className="w-4 h-4" aria-hidden="true" />
            ) : (
              <ChevronDown className="w-4 h-4" aria-hidden="true" />
            )}
          </Button>
        </CollapsibleTrigger>
        <CollapsibleContent id="mobile-toc-content">
          <CardContent className="pt-0 pb-4">
            <nav aria-label="Table of contents" className="space-y-1">
              {headings.map((heading) => (
                <button
                  key={heading.id}
                  onClick={() => scrollToHeading(heading.id)}
                  onKeyDown={(e) => handleKeyDown(e, heading.id)}
                  className={cn(
                    'block w-full text-left text-sm py-1.5 px-2 rounded-md transition-colors',
                    'text-muted-foreground hover:text-foreground hover:bg-muted',
                    'focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1',
                    heading.level === 3 && 'pl-4'
                  )}
                  aria-label={`Jump to ${heading.text}`}
                >
                  {heading.text}
                </button>
              ))}
            </nav>
          </CardContent>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  );

  return (
    <div className={className}>
      {MobileToc}
      {DesktopToc}
    </div>
  );
};
