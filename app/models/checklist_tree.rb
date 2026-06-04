class ChecklistTree < ApplicationRecord
  include Redmine::SafeAttributes

  belongs_to :issue
  belongs_to :author, class_name: 'User', foreign_key: 'author_id', optional: true
  belongs_to :parent,   class_name: 'ChecklistTree', foreign_key: 'parent_id', optional: true
  has_many   :children, class_name: 'ChecklistTree', foreign_key: 'parent_id', dependent: :destroy

  validates :subject,  presence: true, length: { maximum: 512 }
  validates :position, numericality: { only_integer: true, allow_nil: true }


  # 新規作成時のtmpキー解決用仮想属性
  attr_accessor :clt_form_key, :clt_parent_tmp_key

  safe_attributes 'subject', 'position', 'issue_id', 'is_done', 'parent_id',
                  'clt_form_key', 'clt_parent_tmp_key'

  def project
    issue.project if issue
  end

  def parent?
    children.any?
  end

  def child?
    parent_id.present?
  end

  # 子が全員チェック済みなら true
  def all_children_done?
    children.any? && children.all?(&:is_done)
  end

  # 親のis_doneを子の状態に合わせて更新
  def sync_parent_done!
    return unless parent
    new_state = parent.all_children_done?
    parent.update_column(:is_done, new_state) if parent.is_done != new_state
  end

  # 親ONで全子をONに、親OFFで全子をOFFに
  def cascade_to_children!(state)
    children.each do |child|
      child.update_column(:is_done, state)
    end
  end

  def self.recalc_done_ratio(issue)
    config = ChecklistTreeConfig.for_issue(issue.id)
    return unless config.persisted? && config.use_done_ratio
    return unless Setting.issue_done_ratio == 'issue_field'

    items = issue.checklist_trees.reload
    leaves = items.reject { |i| items.any? { |c| c.parent_id == i.id } }
    return if leaves.empty?

    ratio = (leaves.count(&:is_done) * 100) / leaves.count
    issue.update_column(:done_ratio, ratio)
  end
end
