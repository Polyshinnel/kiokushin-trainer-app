import { Search, X } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'

interface SearchInputProps {
  value: string
  onChange: (value: string) => void
  onSearch: (query?: string) => void
  placeholder?: string
}

export function SearchInput({ value, onChange, onSearch, placeholder = 'Поиск...' }: SearchInputProps) {
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      onSearch()
    }
  }

  return (
    <div className="relative flex gap-2">
      <div className="relative flex-1">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
        <Input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          className="pl-10 pr-10"
        />
        {value && (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7"
            onClick={() => {
              onChange('')
              onSearch('')
            }}
          >
            <X className="w-4 h-4" />
          </Button>
        )}
      </div>
      <Button 
        onClick={() => onSearch()}
        style={{ backgroundColor: '#0c194b', color: '#fff' }}
        onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#0f1f5a'}
        onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#0c194b'}
      >
        Найти
      </Button>
    </div>
  )
}

