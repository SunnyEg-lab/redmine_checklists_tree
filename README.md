# redmine_checklists_tree

A Redmine plugin that adds hierarchical checklists (parent/child structure) to issues.

## Features

- **Parent-child checklist items** — organize checklist items in a two-level hierarchy
- **Cascade done state** — checking a parent checks all children; all children checked automatically checks the parent
- **Drag-and-drop reordering** — reorder items and change parent/child relationships via an overlay panel
- **Inline subject editing** — click any item label to edit it directly
- **History logging** — checklist changes are recorded in the issue journal
- **Email notifications** — notify watchers when a checklist item is checked/unchecked
- **Block issue closing** — optionally prevent closing an issue when checklists are incomplete
- **REST API support** — full API access for checklist items
- **i18n** — English and Japanese included

## Requirements

- Redmine 4.0 or higher

## Installation

1. Clone this repository into your Redmine `plugins` directory:

   ```bash
   git clone https://github.com/SunnyEg-lab/redmine_checklists_tree.git /path/to/redmine/plugins/redmine_checklists_tree
   ```

2. Run database migrations:

   ```bash
   bundle exec rake redmine:plugins:migrate RAILS_ENV=production
   ```

3. Restart Redmine.

## Permissions

Configure per-project in **Administration → Roles and permissions**:

| Permission | Description |
|---|---|
| `View checklists` | View checklist items on issues |
| `Check/uncheck checklists` | Mark items as done/undone |
| `Edit checklists` | Add, edit, delete, and reorder items |

## Settings

Go to **Administration → Plugins → Redmine Checklists Tree** to configure:

- **Save history on check change** — record check/uncheck in the issue journal
- **Send email notification on check change** — notify watchers on check state changes
- **Block issue closing when checklists incomplete** — prevent closing if any checklist item is undone

## License

[MIT License](LICENSE)

Copyright (c) 2025 SunnyEg
