CHECKLISTS_TREE_VERSION = '1.0.0'.freeze

Redmine::Plugin.register :redmine_checklists_tree do
  name 'Redmine Checklists Tree plugin'
  author 'SunnyEG'
  description 'Checklist plugin with parent-child hierarchy, history and email notification'
  version CHECKLISTS_TREE_VERSION

  requires_redmine version_or_higher: '4.0'

  settings default: {
    'save_log'            => 1,
    'notify'              => 1,
    'block_issue_closing' => 0
  }, partial: 'settings/checklists_tree/checklists_tree'

  Redmine::AccessControl.map do |map|
    map.project_module :issue_tracking do |map|
      map.permission :view_checklists_tree,  { checklists_tree: [:show, :index] }
      map.permission :done_checklists_tree,  { checklists_tree: :done }
      map.permission :edit_checklists_tree,  { checklists_tree: [:done, :create, :destroy, :update] }
    end
  end
end

if (Rails.configuration.respond_to?(:autoloader) && Rails.configuration.autoloader == :zeitwerk) || Rails.version > '7.0'
  Rails.autoloaders.each { |loader| loader.ignore(File.dirname(__FILE__) + '/lib') }
end
require File.dirname(__FILE__) + '/lib/redmine_checklists_tree'
