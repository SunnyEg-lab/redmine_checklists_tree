class ChecklistTreeConfig < ApplicationRecord
  belongs_to :issue

  def self.for_issue(issue_id)
    find_or_initialize_by(issue_id: issue_id)
  end
end
