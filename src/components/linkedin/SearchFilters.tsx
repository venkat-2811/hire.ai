import { useState } from 'react';
import { X, Plus, RotateCcw, Sparkles, Loader2, ChevronDown, ChevronUp } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Slider } from '@/components/ui/slider';
import { cn } from '@/lib/utils';
import type { LinkedInFilters } from '@/hooks/useLinkedInTalent';

interface SearchFiltersProps {
  filters: LinkedInFilters;
  onChange: (filters: LinkedInFilters) => void;
  onGenerate: () => void;
  onSearch: () => void;
  isGenerating?: boolean;
  isSearching?: boolean;
  candidateCount: number;
  onCandidateCountChange: (n: number) => void;
}

function TagInput({
  label,
  values,
  onChange,
  placeholder,
}: {
  label: string;
  values: string[];
  onChange: (v: string[]) => void;
  placeholder: string;
}) {
  const [input, setInput] = useState('');

  const add = () => {
    const v = input.trim();
    if (v && !values.includes(v)) onChange([...values, v]);
    setInput('');
  };

  const remove = (i: number) => onChange(values.filter((_, idx) => idx !== i));

  return (
    <div className="space-y-1.5">
      <Label className="text-xs text-muted-foreground font-medium uppercase tracking-wide">{label}</Label>
      <div className="flex gap-2">
        <Input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ',') {
              e.preventDefault();
              add();
            }
          }}
          placeholder={placeholder}
          className="h-8 text-sm bg-background/50 border-border/60"
        />
        <Button size="sm" variant="outline" onClick={add} className="h-8 px-2 shrink-0">
          <Plus className="h-3.5 w-3.5" />
        </Button>
      </div>
      {values.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mt-1">
          {values.map((v, i) => (
            <Badge key={i} variant="secondary" className="gap-1 text-xs px-2 py-0.5">
              {v}
              <button onClick={() => remove(i)} className="hover:text-destructive transition-colors">
                <X className="h-2.5 w-2.5" />
              </button>
            </Badge>
          ))}
        </div>
      )}
    </div>
  );
}

const CANDIDATE_COUNTS = [5, 10, 15, 20, 25, 30];

export function SearchFilters({
  filters,
  onChange,
  onGenerate,
  onSearch,
  isGenerating,
  isSearching,
  candidateCount,
  onCandidateCountChange,
}: SearchFiltersProps) {
  const [advancedOpen, setAdvancedOpen] = useState(false);

  const update = (key: keyof LinkedInFilters, value: any) =>
    onChange({ ...filters, [key]: value });

  return (
    <div className="space-y-5">
      {/* Generate + Search Buttons */}
      <div className="flex gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={onGenerate}
          disabled={isGenerating || isSearching}
          className="flex-1 gap-2 border-violet-500/40 text-violet-400 hover:bg-violet-500/10"
        >
          {isGenerating ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Sparkles className="h-3.5 w-3.5" />
          )}
          {isGenerating ? 'Generating…' : 'Generate Search'}
        </Button>
        <Button
          size="sm"
          onClick={onSearch}
          disabled={isSearching || isGenerating}
          className="flex-1 gap-2 bg-blue-600 hover:bg-blue-700 text-white"
        >
          {isSearching ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="currentColor">
              <path d="M16.5 3c-1.74 0-3.41.81-4.5 2.09C10.91 3.81 9.24 3 7.5 3 4.42 3 2 5.42 2 8.5c0 3.78 3.4 6.86 8.55 11.54L12 21.35l1.45-1.32C18.6 15.36 22 12.28 22 8.5 22 5.42 19.58 3 16.5 3z" />
            </svg>
          )}
          {isSearching ? 'Searching…' : 'Search LinkedIn'}
        </Button>
      </div>

      {/* Keywords */}
      <div className="space-y-1.5">
        <Label className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Keywords</Label>
        <Input
          value={filters.keywords || ''}
          onChange={(e) => update('keywords', e.target.value)}
          placeholder="e.g. Senior React Developer"
          className="h-8 text-sm bg-background/50 border-border/60"
        />
      </div>

      {/* Skills */}
      <TagInput
        label="Skills"
        values={filters.skills || []}
        onChange={(v) => update('skills', v)}
        placeholder="Add skill (Enter)"
      />

      {/* Job Titles */}
      <TagInput
        label="Job Titles"
        values={filters.job_titles || []}
        onChange={(v) => update('job_titles', v)}
        placeholder="Add title (Enter)"
      />

      {/* Location */}
      <div className="space-y-1.5">
        <Label className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Location</Label>
        <Input
          value={filters.location || ''}
          onChange={(e) => update('location', e.target.value)}
          placeholder="e.g. San Francisco, CA"
          className="h-8 text-sm bg-background/50 border-border/60"
        />
      </div>

      {/* Experience Range */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label className="text-xs text-muted-foreground font-medium uppercase tracking-wide">
            Experience
          </Label>
          <span className="text-xs font-semibold text-foreground">
            {filters.experience_min ?? 0}–{filters.experience_max ?? 10}+ yrs
          </span>
        </div>
        <Slider
          min={0}
          max={20}
          step={1}
          value={[filters.experience_min ?? 0, filters.experience_max ?? 10]}
          onValueChange={([min, max]) => {
            update('experience_min', min);
            update('experience_max', max);
          }}
          className="mt-1"
        />
      </div>

      {/* Advanced Toggle */}
      <button
        className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
        onClick={() => setAdvancedOpen(!advancedOpen)}
      >
        {advancedOpen ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
        {advancedOpen ? 'Hide' : 'Show'} Advanced Filters
      </button>

      {advancedOpen && (
        <div className="space-y-4 pt-1 border-t border-border/40">
          <TagInput
            label="Industry"
            values={filters.industry ? [filters.industry] : []}
            onChange={(v) => update('industry', v[v.length - 1] || '')}
            placeholder="e.g. Technology"
          />
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Seniority</Label>
            <Input
              value={filters.seniority || ''}
              onChange={(e) => update('seniority', e.target.value)}
              placeholder="e.g. Senior, Manager"
              className="h-8 text-sm bg-background/50 border-border/60"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Company</Label>
            <Input
              value={filters.company || ''}
              onChange={(e) => update('company', e.target.value)}
              placeholder="Target company name"
              className="h-8 text-sm bg-background/50 border-border/60"
            />
          </div>
          <TagInput
            label="Similar Roles"
            values={filters.similar_roles || []}
            onChange={(v) => update('similar_roles', v)}
            placeholder="Add similar role (Enter)"
          />
        </div>
      )}

      {/* Divider */}
      <div className="border-t border-border/40 pt-4">
        {/* Candidate Count Selector */}
        <div className="space-y-2.5">
          <div className="flex items-center justify-between">
            <Label className="text-xs text-muted-foreground font-medium uppercase tracking-wide">
              Candidates to Retrieve
            </Label>
            <span className="text-sm font-bold text-foreground">{candidateCount}</span>
          </div>
          <div className="grid grid-cols-6 gap-1.5">
            {CANDIDATE_COUNTS.map((n) => (
              <button
                key={n}
                onClick={() => onCandidateCountChange(n)}
                className={cn(
                  'py-1.5 rounded-lg text-xs font-semibold transition-all border',
                  candidateCount === n
                    ? 'bg-blue-600 text-white border-blue-600 shadow-sm'
                    : 'bg-background/50 text-muted-foreground border-border/50 hover:border-blue-500/50 hover:text-foreground'
                )}
              >
                {n}
              </button>
            ))}
          </div>
          {candidateCount === 30 && (
            <p className="text-xs text-amber-400/80 bg-amber-500/10 rounded-lg px-3 py-2">
              ⚠️ Maximum of 30 candidate profiles per search.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
