import { BloggerDataService } from '../infrastructure/BloggerDataService';
import { UIManager } from './UIManager';

export class SearchAutocompleteRenderer {
  private dropdown: HTMLElement | null = null;
  private selectedIndex: number = -1;
  private suggestions: string[] = [];

  constructor(
    private inputId: string,
    private bloggerService: BloggerDataService
  ) {
    this.init();
  }

  private init(): void {
    const input = UIManager.el<HTMLInputElement>(this.inputId);
    if (!input) return;

    input.setAttribute('autocomplete', 'off');

    // Create dropdown
    this.dropdown = document.createElement('div');
    this.dropdown.className = 'antinna-search-dropdown';
    this.dropdown.style.cssText = `
        position: absolute; top: 100%; left: 0; width: 100%; background: var(--card);
        border: 1px solid rgba(0,0,0,0.1); border-radius: 0 0 12px 12px;
        box-shadow: 0 10px 25px rgba(0,0,0,0.1); z-index: 2000; display: none;
        max-height: 300px; overflow-y: auto; margin-top: -1px;
    `;
    input.parentElement?.style.setProperty('position', 'relative');
    input.parentElement?.appendChild(this.dropdown);

    let debounceTimer: any;
    input.oninput = () => {
        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(() => this.handleInput(input.value), 300);
    };

    input.onkeydown = (e) => this.handleKeydown(e);

    document.addEventListener('click', (e) => {
        if (!input.contains(e.target as Node) && !this.dropdown?.contains(e.target as Node)) {
            this.hide();
        }
    });
  }

  private async handleInput(value: string): Promise<void> {
    if (value.length < 2) {
        this.hide();
        return;
    }

    this.suggestions = await this.bloggerService.fetchSearchSuggestions(value);
    this.render();
  }

  private render(): void {
    if (!this.dropdown) return;

    if (this.suggestions.length === 0) {
        this.hide();
        return;
    }

    this.dropdown.innerHTML = this.suggestions.map((s, i) => `
        <div class="antinna-search-item ${i === this.selectedIndex ? 'active' : ''}"
             style="padding: 12px 15px; cursor: pointer; border-bottom: 1px solid rgba(0,0,0,0.05); font-size: 0.9rem; transition: background 0.2s;"
             onclick="window.handleSuggestionClick('${s.replace(/'/g, "\\'")}')">
            ${s}
        </div>
    `).join('');

    (window as any).handleSuggestionClick = (val: string) => this.select(val);

    this.dropdown.style.display = 'block';
  }

  private handleKeydown(e: KeyboardEvent): void {
    if (this.dropdown?.style.display !== 'block') return;

    if (e.key === 'ArrowDown') {
        e.preventDefault();
        this.selectedIndex = (this.selectedIndex + 1) % this.suggestions.length;
        this.render();
    } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        this.selectedIndex = (this.selectedIndex - 1 + this.suggestions.length) % this.suggestions.length;
        this.render();
    } else if (e.key === 'Enter' && this.selectedIndex >= 0) {
        e.preventDefault();
        this.select(this.suggestions[this.selectedIndex]);
    } else if (e.key === 'Escape') {
        this.hide();
    }
  }

  private select(val: string): void {
    const input = UIManager.el<HTMLInputElement>(this.inputId);
    if (input) {
        input.value = val;
        this.hide();
        input.form?.dispatchEvent(new Event('submit', { cancelable: true, bubbles: true }));
    }
  }

  private hide(): void {
    if (this.dropdown) {
        this.dropdown.style.display = 'none';
        this.selectedIndex = -1;
    }
  }
}
