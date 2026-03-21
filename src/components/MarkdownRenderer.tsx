import { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Typography, Link, Box, Divider, IconButton, Popover, Button, CircularProgress, Alert } from '@mui/material';
import BookmarkBorderIcon from '@mui/icons-material/BookmarkBorder';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import type { Components } from 'react-markdown';

interface MarkdownRendererProps {
  content: string;
  onSaveArticle?: (url: string, title: string) => Promise<{ success: boolean; error?: string; articlesCount?: number }>;
}

interface LinkWithPopoverProps {
  href: string;
  children: React.ReactNode;
  onSaveArticle?: (url: string, title: string) => Promise<{ success: boolean; error?: string; articlesCount?: number }>;
}

function LinkWithPopover({ href, children, onSaveArticle }: LinkWithPopoverProps) {
  const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleOpenPopover = (event: React.MouseEvent<HTMLElement>) => {
    event.preventDefault();
    event.stopPropagation();
    setAnchorEl(event.currentTarget);
    setError(null);
  };

  const handleClosePopover = () => {
    setAnchorEl(null);
    if (saved) {
      setSaved(false);
    }
  };

  const handleSave = async () => {
    if (!onSaveArticle || !href) return;

    setSaving(true);
    setError(null);

    try {
      const title = typeof children === 'string' ? children : 'Article';
      const result = await onSaveArticle(href, title);
      
      if (result.success) {
        setSaved(true);
        setTimeout(() => {
          handleClosePopover();
        }, 1500);
      } else {
        setError(result.error || 'Failed to save article');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save article');
    } finally {
      setSaving(false);
    }
  };

  const open = Boolean(anchorEl);

  return (
    <>
      <Link 
        href={href} 
        target="_blank" 
        rel="noopener noreferrer" 
        underline="hover"
        sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.5 }}
      >
        {children}
        {onSaveArticle && (
          <IconButton
            size="small"
            onClick={handleOpenPopover}
            sx={{ 
              ml: 0.25,
              p: 0.25,
              color: 'text.secondary',
              '&:hover': { color: 'primary.main' },
            }}
          >
            <BookmarkBorderIcon sx={{ fontSize: '0.875rem' }} />
          </IconButton>
        )}
      </Link>
      
      {onSaveArticle && (
        <Popover
          open={open}
          anchorEl={anchorEl}
          onClose={handleClosePopover}
          anchorOrigin={{
            vertical: 'bottom',
            horizontal: 'left',
          }}
          transformOrigin={{
            vertical: 'top',
            horizontal: 'left',
          }}
          sx={{
            '& .MuiPopover-paper': {
              maxWidth: 320,
              p: 2,
            },
          }}
        >
          {saved ? (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <CheckCircleIcon color="success" />
              <Typography variant="body2">Saved to Reading List!</Typography>
            </Box>
          ) : (
            <>
              <Typography variant="subtitle2" gutterBottom sx={{ fontWeight: 600 }}>
                Save to Reading List
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                {typeof children === 'string' ? children : 'Article'}
              </Typography>
              {error && (
                <Alert severity="error" sx={{ mb: 2, py: 0 }}>
                  {error}
                </Alert>
              )}
              <Box sx={{ display: 'flex', gap: 1, justifyContent: 'flex-end' }}>
                <Button size="small" onClick={handleClosePopover} disabled={saving}>
                  Cancel
                </Button>
                <Button
                  size="small"
                  variant="contained"
                  onClick={handleSave}
                  disabled={saving}
                  startIcon={saving ? <CircularProgress size={16} /> : null}
                >
                  {saving ? 'Saving...' : 'Save'}
                </Button>
              </Box>
            </>
          )}
        </Popover>
      )}
    </>
  );
}

export default function MarkdownRenderer({ content, onSaveArticle }: MarkdownRendererProps) {
  const components: Components = {
    h1: ({ children }) => (
      <Typography 
        variant="h4" 
        component="h1" 
        gutterBottom 
        sx={{ 
          mt: 3, 
          mb: 2, 
          fontWeight: 700,
          fontSize: '1.5rem',
          letterSpacing: '0.02em',
        }}
      >
        {children}
      </Typography>
    ),
    h2: ({ children }) => (
      <Typography 
        variant="h5" 
        component="h2" 
        gutterBottom 
        sx={{ 
          mt: 2.5, 
          mb: 1.5, 
          fontWeight: 700,
          fontSize: '1.25rem',
          letterSpacing: '0.02em',
        }}
      >
        {children}
      </Typography>
    ),
    h3: ({ children }) => (
      <Typography 
        variant="h6" 
        component="h3" 
        gutterBottom 
        sx={{ 
          mt: 2, 
          mb: 1, 
          fontWeight: 700,
          fontSize: '1.1rem',
          letterSpacing: '0.02em',
        }}
      >
        {children}
      </Typography>
    ),
    h4: ({ children }) => (
      <Typography 
        variant="subtitle1" 
        component="h4" 
        gutterBottom 
        sx={{ 
          mt: 1.5, 
          mb: 1, 
          fontWeight: 700,
        }}
      >
        {children}
      </Typography>
    ),
    h5: ({ children }) => (
      <Typography 
        variant="subtitle2" 
        component="h5" 
        gutterBottom 
        sx={{ 
          mt: 1.5, 
          mb: 1, 
          fontWeight: 600,
        }}
      >
        {children}
      </Typography>
    ),
    h6: ({ children }) => (
      <Typography 
        variant="subtitle2" 
        component="h6" 
        gutterBottom 
        sx={{ 
          mt: 1.5, 
          mb: 1, 
          fontWeight: 600,
        }}
      >
        {children}
      </Typography>
    ),
    p: ({ children, node }) => {
      // Check if this is the first paragraph for drop cap
      const isFirstParagraph = node?.position?.start.line === 1;
      
      return (
        <Typography 
          variant="body1" 
          paragraph 
          sx={{ 
            mb: 2, 
            lineHeight: 1.8,
            textAlign: 'justify',
            ...(isFirstParagraph && {
              '&::first-letter': {
                float: 'left',
                fontSize: '3em',
                lineHeight: 0.9,
                fontWeight: 700,
                fontFamily: '"Playfair Display", Georgia, serif',
                marginRight: '0.1em',
                marginTop: '0.05em',
              },
            }),
          }}
        >
          {children}
        </Typography>
      );
    },
    a: ({ href, children }) => (
      <LinkWithPopover href={href || ''} onSaveArticle={onSaveArticle}>
        {children}
      </LinkWithPopover>
    ),
    ul: ({ children }) => (
      <Box component="ul" sx={{ mb: 2, pl: 3 }}>
        {children}
      </Box>
    ),
    ol: ({ children }) => (
      <Box component="ol" sx={{ mb: 2, pl: 3 }}>
        {children}
      </Box>
    ),
    li: ({ children }) => (
      <Typography component="li" variant="body1" sx={{ mb: 0.5, lineHeight: 1.7 }}>
        {children}
      </Typography>
    ),
    blockquote: ({ children }) => (
      <Box
        component="blockquote"
        sx={{
          borderLeft: 4,
          borderColor: 'primary.main',
          pl: 2,
          py: 0.5,
          my: 2,
          fontStyle: 'italic',
          color: 'text.secondary',
        }}
      >
        {children}
      </Box>
    ),
    hr: () => <Divider sx={{ my: 3 }} />,
    code: ({ children, ...props }) => {
      const inline = !props.className;
      return inline ? (
        <Box
          component="code"
          sx={{
            bgcolor: 'grey.100',
            px: 0.75,
            py: 0.25,
            borderRadius: 0.5,
            fontFamily: 'monospace',
            fontSize: '0.875em',
          }}
        >
          {children}
        </Box>
      ) : (
        <Box
          component="pre"
          sx={{
            bgcolor: 'grey.100',
            p: 2,
            borderRadius: 1,
            overflow: 'auto',
            mb: 2,
          }}
        >
          <code style={{ fontFamily: 'monospace', fontSize: '0.875rem' }}>{children}</code>
        </Box>
      );
    },
    table: ({ children }) => (
      <Box sx={{ overflowX: 'auto', mb: 2 }}>
        <Box component="table" sx={{ width: '100%', borderCollapse: 'collapse' }}>
          {children}
        </Box>
      </Box>
    ),
    th: ({ children }) => (
      <Box
        component="th"
        sx={{
          border: 1,
          borderColor: 'divider',
          p: 1,
          bgcolor: 'grey.100',
          fontWeight: 600,
          textAlign: 'left',
        }}
      >
        {children}
      </Box>
    ),
    td: ({ children }) => (
      <Box component="td" sx={{ border: 1, borderColor: 'divider', p: 1 }}>
        {children}
      </Box>
    ),
  };

  return (
    <Box sx={{ '& > *:first-of-type': { mt: 0 } }}>
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
        {content}
      </ReactMarkdown>
    </Box>
  );
}
