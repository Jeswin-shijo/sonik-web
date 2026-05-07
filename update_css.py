css_addition = """
/* Metadata Tabs Styles */
.metadata-tabs-section {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

.metadata-tabs {
  display: flex;
  align-items: center;
  gap: 1.5rem;
  border-bottom: 1px solid var(--border);
  padding-bottom: 0;
  margin-bottom: 0.5rem;
  overflow-x: auto;
}

.metadata-tab-btn {
  background: transparent;
  border: none;
  color: var(--muted);
  font-size: 1.1rem;
  font-weight: 700;
  padding: 0.5rem 0.25rem 0.75rem;
  cursor: pointer;
  position: relative;
  transition: color 200ms ease;
  display: flex;
  align-items: center;
  gap: 0.5rem;
  white-space: nowrap;
}

.metadata-tab-btn:hover {
  color: var(--text);
}

.metadata-tab-btn.is-active {
  color: var(--text);
}

.metadata-tab-btn::after {
  content: '';
  position: absolute;
  bottom: -1px;
  left: 0;
  right: 0;
  height: 2px;
  background-color: var(--gold);
  transform: scaleX(0);
  transition: transform 250ms cubic-bezier(0.2, 0.8, 0.2, 1);
  transform-origin: center;
}

.metadata-tab-btn.is-active::after {
  transform: scaleX(1);
}

.metadata-tab-btn .tab-count {
  font-size: 0.75rem;
  font-weight: 600;
  background: var(--control-bg-strong);
  color: var(--muted-strong);
  padding: 0.1rem 0.4rem;
  border-radius: 99px;
}

.metadata-tab-btn.is-active .tab-count {
  background: rgba(245, 193, 93, 0.2);
  color: var(--gold);
}

@keyframes fadeInUpTab {
  from {
    opacity: 0;
    transform: translateY(10px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.fade-in-up {
  animation: fadeInUpTab 300ms cubic-bezier(0.2, 0.8, 0.2, 1) forwards;
}
"""

def main():
    file_path = '/Users/jeswin/Desktop/projects/sonik/sonik-web/src/App.css'
    with open(file_path, 'r') as f:
        content = f.read()

    if "/* Metadata Tabs Styles */" not in content:
        with open(file_path, 'a') as f:
            f.write(css_addition)
            
    print("Successfully added metadata tabs CSS to App.css.")

if __name__ == '__main__':
    main()
