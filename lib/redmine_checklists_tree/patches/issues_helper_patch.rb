module RedmineChecklistsTree
  module Patches
    module IssuesHelperPatch
      def self.included(base)
        base.class_eval do
          alias_method :details_to_strings_without_checklist_tree, :details_to_strings
          alias_method :details_to_strings, :details_to_strings_with_checklist_tree
        end
      end

      def details_to_strings_with_checklist_tree(details, no_html = false, options = {})
        tree_details, others = details.partition { |d| d.prop_key == 'checklist_tree' }

        result = tree_details.flat_map do |detail|
          next [] unless @issue && User.current.allowed_to?(:view_checklists_tree, @issue.project)

          was    = parse_checklist_tree_json(detail.old_value)
          became = parse_checklist_tree_json(detail.value)

          was_ids    = was.map    { |i| i[:id] }.compact
          became_ids = became.map { |i| i[:id] }.compact

          lines = []

          # 追加されたアイテム
          became.each do |item|
            next if was_ids.include?(item[:id])
            lines << format_clt_line(item[:subject], :added, no_html)
          end

          # 削除されたアイテム
          was.each do |item|
            next if became_ids.include?(item[:id])
            lines << format_clt_line(item[:subject], :deleted, no_html)
          end

          # チェック状態・親が変わったアイテム
          became.each do |item|
            old_item = was.find { |w| w[:id] == item[:id] }
            next unless old_item
            if old_item[:is_done] != item[:is_done]
              state = item[:is_done] ? :done : :undone
              lines << format_clt_line(item[:subject], state, no_html, item[:is_done])
            end
            if old_item[:parent_id].to_s != item[:parent_id].to_s
              lines << format_clt_line(item[:subject], :moved, no_html)
            end
          end

          # 変更あり（位置変更等）だが内容が特定できない場合
          if lines.empty?
            lines << (no_html ? I18n.t(:label_checklist_tree_reordered) :
                      "<b>#{ERB::Util.h I18n.t(:label_checklist_tree_plural)}</b> #{ERB::Util.h I18n.t(:label_checklist_tree_reordered)}")
          end

          lines
        end

        result_str = result.join(no_html ? "\n" : '</li><li>')
        result_str = result_str.html_safe unless no_html

        other_strings = details_to_strings_without_checklist_tree(others, no_html, options)
        result.any? ? [result_str] + other_strings : other_strings
      end

      private

      def format_clt_line(subject, state, no_html, is_done = nil)
        label = case state
                when :added   then I18n.t(:label_checklist_tree_item_added)
                when :deleted then I18n.t(:label_checklist_tree_item_deleted)
                when :done    then I18n.t(:label_checklist_tree_done)
                when :undone  then I18n.t(:label_checklist_tree_undone)
                when :moved   then I18n.t(:label_checklist_tree_item_moved)
                end

        if no_html
          cb = is_done.nil? ? '' : (is_done ? '[x] ' : '[ ] ')
          "#{cb}#{subject} #{label}"
        else
          cb_html = is_done.nil? ? '' :
            "<input type='checkbox' #{is_done ? 'checked' : ''} disabled> "
          "<b>#{ERB::Util.h I18n.t(:label_checklist_tree_item)}</b> " \
          "#{cb_html}<i>#{ERB::Util.h subject}</i> #{ERB::Util.h label}"
        end
      end

      def parse_checklist_tree_json(json)
        return [] if json.blank?
        data = JSON.parse(json)
        data = [data] unless data.is_a?(Array)
        data.map(&:symbolize_keys)
      rescue JSON::ParserError
        []
      end
    end
  end
end

unless IssuesHelper.included_modules.include?(RedmineChecklistsTree::Patches::IssuesHelperPatch)
  IssuesHelper.send(:include, RedmineChecklistsTree::Patches::IssuesHelperPatch)
end
