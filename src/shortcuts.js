class ShortcutsManager {
  constructor() {
    this.container = null;
    this.grid = null;
    this.prototype = null;
    this.addShortcutPrototype = null;
    this.dialog = null;
    this.dialogTitle = null;
    this.titleInput = null;
    this.urlInput = null;
    this.contextMenu = null;
    this.draggedElement = null;
    this.draggedIndex = null;
    this.editingIndex = null; // Track which shortcut is being edited
  }

  init(container, grid) {
    this.container = container;
    this.grid = grid;
    this.prototype = document.getElementById('shortcutPrototype');
    this.addShortcutPrototype = document.getElementById('addShortcutPrototype');
    this.dialog = document.getElementById('addShortcutDialog');
    this.dialogTitle = document.getElementById('dialogTitle');
    this.titleInput = document.getElementById('shortcutTitle');
    this.urlInput = document.getElementById('shortcutUrl');
    this.contextMenu = document.getElementById('contextMenu');

    // Set grid columns based on config
    const elementsPerRow = config.elementsPerRow;
    this.grid.style.gridTemplateColumns = `repeat(${elementsPerRow}, minmax(0, 1fr))`;

    // Setup dialog event handlers
    document.getElementById('saveShortcut').addEventListener('click', () => this.saveShortcut());
    document.getElementById('cancelShortcut').addEventListener('click', () => this.closeDialog());

    // Setup context menu handlers
    document.getElementById('editShortcut').addEventListener('click', () => this.handleEdit());
    document.getElementById('deleteShortcut').addEventListener('click', () => this.handleDelete());

    // Close context menu when clicking anywhere else
    document.addEventListener('click', (e) => {
      if (!this.contextMenu.contains(e.target)) {
        this.hideContextMenu();
      }
    });
  }

  render() {
    this.grid.innerHTML = '';
    const shortcuts = config.shortcuts; // Display all shortcuts

    shortcuts.forEach((shortcut, index) => {
      // Clone the prototype
      const card = this.prototype.cloneNode(true);
      card.id = ''; // Remove the ID from the clone
      card.classList.remove('hidden'); // Make it visible
      card.href = shortcut.url;
      card.draggable = true;
      card.dataset.index = index;

      // Fill in the data
      const img = card.querySelector('.shortcut-icon');
      // Extract domain from URL for favicon
      let domain;
      try {
        domain = new URL(shortcut.url).hostname;
      } catch (e) {
        domain = shortcut.url;
      }
      img.src = `https://www.google.com/s2/favicons?sz=32&domain=${domain}`;
      img.alt = shortcut.title;

      const title = card.querySelector('.shortcut-title');
      title.textContent = shortcut.title;

      this.grid.appendChild(card);

      // Drag event listeners
      card.addEventListener('dragstart', (e) => this.handleDragStart(e));
      card.addEventListener('dragenter', (e) => this.handleDragEnter(e));
      card.addEventListener('dragover', (e) => this.handleDragOver(e));
      card.addEventListener('drop', (e) => this.handleDrop(e));
      card.addEventListener('dragend', (e) => this.handleDragEnd(e));

      // Context menu listener
      card.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        this.showContextMenu(e, index);
      });
    });

    // Add "+" button if there's room for more shortcuts (always shown last)
    if (shortcuts.length < config.maxShortcuts) {
      const addButton = this.addShortcutPrototype.cloneNode(true);
      addButton.id = ''; // Remove the ID from the clone
      addButton.classList.remove('hidden'); // Make it visible
      addButton.draggable = false; // Make it non-draggable
      addButton.addEventListener('click', () => this.openDialog());
      this.grid.appendChild(addButton);
    }
  }

  handleDragStart(e) {
    this.draggedElement = e.currentTarget;
    this.draggedIndex = parseInt(e.currentTarget.dataset.index);
    e.currentTarget.style.opacity = '0.4';
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/html', e.currentTarget.innerHTML);
  }

  handleDragOver(e) {
    e.preventDefault();
    e.stopPropagation();
    e.dataTransfer.dropEffect = 'move';
    return false;
  }

  handleDragEnter(e) {
    e.preventDefault();
  }

  async handleDrop(e) {
    e.stopPropagation();
    e.preventDefault();

    const targetElement = e.currentTarget;
    const targetIndex = parseInt(targetElement.dataset.index);

    if (this.draggedElement !== targetElement && this.draggedIndex !== targetIndex) {
      // Reorder shortcuts array
      const shortcuts = [...config.shortcuts];
      const [removed] = shortcuts.splice(this.draggedIndex, 1);

      // Adjust target index if we removed an item before it
      const adjustedTargetIndex = this.draggedIndex < targetIndex ? targetIndex - 1 : targetIndex;
      shortcuts.splice(adjustedTargetIndex, 0, removed);

      // Save to config
      await config.setShortcuts(shortcuts);

      // Re-render
      this.render();
    }

    return false;
  }

  handleDragEnd(e) {
    e.currentTarget.style.opacity = '1';
    this.draggedElement = null;
    this.draggedIndex = null;
  }

  show() {
    this.container.classList.remove('hidden');
    this.render();
  }

  hide() {
    this.container.classList.add('hidden');
  }

  openDialog(editIndex = null) {
    this.editingIndex = editIndex;

    if (editIndex !== null) {
      // Edit mode
      const shortcut = config.shortcuts[editIndex];
      this.dialogTitle.textContent = 'Edit Shortcut';
      this.titleInput.value = shortcut.title;
      this.urlInput.value = shortcut.url;
    } else {
      // Add mode
      this.dialogTitle.textContent = 'Add Shortcut';
      this.titleInput.value = '';
      this.urlInput.value = '';
    }

    this.dialog.showModal();
  }

  closeDialog() {
    this.dialog.close();
    this.editingIndex = null;
  }

  async saveShortcut() {
    const title = this.titleInput.value.trim();
    const url = this.urlInput.value.trim();

    if (!title || !url) {
      return;
    }

    const shortcuts = [...config.shortcuts];

    if (this.editingIndex !== null) {
      // Edit existing shortcut
      shortcuts[this.editingIndex] = new ShortcutEntry(title, url);
    } else {
      // Add new shortcut
      shortcuts.push(new ShortcutEntry(title, url));
    }

    await config.setShortcuts(shortcuts);

    // Close dialog and re-render
    this.closeDialog();
    this.render();
  }

  showContextMenu(e, index) {
    this.editingIndex = index;
    this.contextMenu.style.left = `${e.pageX}px`;
    this.contextMenu.style.top = `${e.pageY}px`;
    this.contextMenu.classList.remove('hidden');
  }

  hideContextMenu() {
    this.contextMenu.classList.add('hidden');
  }

  handleEdit() {
    this.hideContextMenu();
    this.openDialog(this.editingIndex);
  }

  async handleDelete() {
    this.hideContextMenu();

    if (this.editingIndex !== null) {
      const shortcuts = [...config.shortcuts];
      shortcuts.splice(this.editingIndex, 1);
      await config.setShortcuts(shortcuts);
      this.render();
    }
  }
}

const shortcutsManager = new ShortcutsManager();
