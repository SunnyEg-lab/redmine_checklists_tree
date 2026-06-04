require_dependency 'issues_controller'

module RedmineChecklistsTree
  module Patches
    module IssuesControllerPatch
      def self.included(base)
        base.class_eval do
          # 保存前の状態をIssueインスタンスに記録（IssuePatchのafter_saveで使用）
          before_action :save_checklist_tree_before_state, only: [:update]
        end
      end

      def save_checklist_tree_before_state
        @issue.instance_variable_set(
          :@old_checklist_trees_json,
          @issue.checklist_trees.to_json
        )
      end
    end
  end
end

unless IssuesController.included_modules.include?(RedmineChecklistsTree::Patches::IssuesControllerPatch)
  IssuesController.send(:include, RedmineChecklistsTree::Patches::IssuesControllerPatch)
end
