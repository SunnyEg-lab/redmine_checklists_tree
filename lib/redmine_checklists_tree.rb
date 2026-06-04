module RedmineChecklistsTree
  def self.settings
    Setting.plugin_redmine_checklists_tree.blank? ? {} : Setting.plugin_redmine_checklists_tree
  end

  def self.save_log?
    settings['save_log'].to_i > 0
  end

  def self.notify?
    settings['notify'].to_i > 0
  end

  def self.block_issue_closing?
    settings['block_issue_closing'].to_i > 0
  end
end

require File.dirname(__FILE__) + '/redmine_checklists_tree/patches/application_helper_patch'
require File.dirname(__FILE__) + '/redmine_checklists_tree/patches/issue_patch'
require File.dirname(__FILE__) + '/redmine_checklists_tree/patches/issues_controller_patch'
require File.dirname(__FILE__) + '/redmine_checklists_tree/patches/issues_helper_patch'
require File.dirname(__FILE__) + '/redmine_checklists_tree/hooks/views_issues_hook'
require File.dirname(__FILE__) + '/redmine_checklists_tree/hooks/views_layouts_hook'
