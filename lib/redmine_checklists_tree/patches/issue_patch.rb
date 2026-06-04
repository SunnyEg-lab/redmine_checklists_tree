require_dependency 'issue'

module RedmineChecklistsTree
  module Patches
    module IssuePatch
      def self.included(base)
        base.send(:include, InstanceMethods)
        base.class_eval do
          has_many :checklist_trees,
                   -> { order("#{ChecklistTree.table_name}.position") },
                   class_name:  'ChecklistTree',
                   dependent:   :destroy,
                   inverse_of:  :issue

          has_one :checklist_tree_config,
                  class_name: 'ChecklistTreeConfig',
                  dependent:  :destroy

          accepts_nested_attributes_for :checklist_trees,
                                        allow_destroy: true,
                                        reject_if: proc { |a| a['subject'].blank? }

          alias_method :checklist_trees_attributes_orig=, :checklist_trees_attributes=

          def checklist_trees_attributes=(attrs)
            if attrs.is_a?(Hash)
              # 生のattrハッシュを保存（resolve_clt_tmp_parentsで使用）
              instance_variable_set(:@clt_raw_attrs, attrs)

              processed = {}
              attrs.each do |form_key, v|
                v = v.dup
                # tmp_のparent_idは一時的にnilにして保存後に解決
                v['parent_id'] = nil if v['parent_id'].to_s.start_with?('tmp_')
                processed[form_key] = v
              end
              self.checklist_trees_attributes_orig = processed
            else
              self.checklist_trees_attributes_orig = attrs
            end
          end

          # Redmineのcreate_journalより先にjournal詳細を追加するためprepend: true
          after_save :add_clt_journal_detail, prepend: true
          after_save :resolve_clt_tmp_parents
          after_save :save_clt_journal_if_not_persisted

          validate :block_closing_if_checklist_tree_incomplete

          safe_attributes 'checklist_trees_attributes',
            if: lambda { |issue, user|
              user.allowed_to?(:done_checklists_tree, issue.project) ||
              user.allowed_to?(:edit_checklists_tree, issue.project)
            }
        end
      end

      module InstanceMethods
        def add_clt_journal_detail
          old_json = instance_variable_get(:@old_checklist_trees_json)
          return unless old_json
          return unless RedmineChecklistsTree.save_log?

          new_json = checklist_trees.reload.to_json
          return if clt_normalize(old_json) == clt_normalize(new_json)

          journal = instance_variable_get(:@current_journal)
          return unless journal

          journal.details.build(
            property:  'attr',
            prop_key:  'checklist_tree',
            old_value: old_json,
            value:     new_json
          )
        rescue => e
          Rails.logger.error "ChecklistTree add_clt_journal_detail error: #{e.message}"
        end

        def save_clt_journal_if_not_persisted
          j = instance_variable_get(:@current_journal)
          return unless j
          return if j.persisted?
          return unless j.details.any? { |d| d.prop_key == 'checklist_tree' }
          j.save
        rescue => e
          Rails.logger.error "ChecklistTree save_clt_journal error: #{e.message}"
        end

        # 保存後：生のattrハッシュを使ってtmpキーを実IDに解決
        def resolve_clt_tmp_parents
          raw = instance_variable_get(:@clt_raw_attrs)
          return unless raw.is_a?(Hash)
          instance_variable_set(:@clt_raw_attrs, nil)

          # tmp_parent_idを持つ子を特定
          children_to_resolve = raw.select { |_k, v| v['parent_id'].to_s.start_with?('tmp_') }
          return if children_to_resolve.empty?

          # form_key → real_id のマップを構築
          # 既存アイテム（idあり）: そのまま
          # 新規アイテム（idなし）: subject+positionでDB検索
          key_to_id = {}
          raw.each do |form_key, v|
            real_id = v['id'].present? ? v['id'].to_i : nil
            if real_id && real_id > 0
              key_to_id[form_key] = real_id
            else
              # 新規アイテム → 保存後のDBから探す
              item = checklist_trees.detect do |t|
                t.subject == v['subject'] &&
                t.position == v['position'].to_i &&
                t.id.present?
              end
              key_to_id[form_key] = item.id if item
            end
          end

          # 子のparent_idを実IDで更新
          children_to_resolve.each do |form_key, v|
            parent_tmp    = v['parent_id'].to_s
            parent_key    = parent_tmp.sub('tmp_', '')
            parent_real_id = key_to_id[parent_key]
            next unless parent_real_id

            child_real_id = key_to_id[form_key]
            next unless child_real_id

            ChecklistTree.where(id: child_real_id).update_all(parent_id: parent_real_id)
          end
        rescue => e
          Rails.logger.error "ChecklistTree resolve_clt_tmp_parents error: #{e.message}"
        end

        def clt_normalize(json)
          return [] if json.blank?
          data = JSON.parse(json)
          data = [data] unless data.is_a?(Array)
          data.map { |i|
            i = i.symbolize_keys
            { id: i[:id], subject: i[:subject],
              is_done: i[:is_done], parent_id: i[:parent_id], position: i[:position] }
          }.sort_by { |i| i[:id].to_i }
        rescue JSON::ParserError
          []
        end

        def block_closing_if_checklist_tree_incomplete
          return unless RedmineChecklistsTree.block_issue_closing?
          return unless status&.is_closed?
          leaves = checklist_trees.reject { |i| checklist_trees.any? { |c| c.parent_id == i.id } }
          return if leaves.empty?
          unless leaves.all?(&:is_done)
            errors.add(:base, I18n.t(:label_checklists_tree_must_complete))
          end
        end
      end
    end
  end
end

unless Issue.included_modules.include?(RedmineChecklistsTree::Patches::IssuePatch)
  Issue.send(:include, RedmineChecklistsTree::Patches::IssuePatch)
end
