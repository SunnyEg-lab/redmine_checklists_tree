module RedmineChecklistsTree
  module Patches
    module ApplicationHelperPatch
      def self.included(base)
        base.send(:include, ChecklistsTreeHelper)
      end
    end
  end
end

unless ApplicationHelper.included_modules.include?(RedmineChecklistsTree::Patches::ApplicationHelperPatch)
  ApplicationHelper.send(:include, RedmineChecklistsTree::Patches::ApplicationHelperPatch)
end
