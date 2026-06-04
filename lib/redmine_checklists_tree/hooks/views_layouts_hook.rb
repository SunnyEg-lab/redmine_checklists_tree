module RedmineChecklistsTree
  module Hooks
    class ViewsLayoutsHook < Redmine::Hook::ViewListener
      def view_layouts_base_html_head(context = {})
        javascript_include_tag(:checklists_tree, plugin: 'redmine_checklists_tree') +
          stylesheet_link_tag(:checklists_tree, plugin: 'redmine_checklists_tree')
      end
    end
  end
end
