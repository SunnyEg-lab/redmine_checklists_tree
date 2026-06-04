class ChecklistsTreeController < ApplicationController
  before_action :find_item,   except: [:index, :create]
  before_action :find_issue,  only:   [:index, :create]
  before_action :authorize,   except: [:done]
  helper :issues

  accept_api_auth :index, :show, :create, :update, :destroy

  def index
    @items = @issue.checklist_trees.order(:position)
    respond_to { |f| f.api }
  end

  def show
    respond_to { |f| f.api }
  end

  def create
    @item = ChecklistTree.new(item_params)
    @item.issue  = @issue
    @item.author = User.current
    respond_to do |format|
      format.api do
        if @item.save
          render action: 'show', status: :created, location: checklist_tree_url(@item)
        else
          render_validation_errors(@item)
        end
      end
    end
  end

  def update
    @item.safe_attributes = item_params
    respond_to do |format|
      format.api do
        if @item.save
          render_api_ok
        else
          render_validation_errors(@item)
        end
      end
    end
  end

  def destroy
    @item.destroy
    respond_to { |f| f.api { render_api_ok } }
  end

  def done
    project = @item.issue.project
    unless User.current.allowed_to?(:done_checklists_tree, project) ||
           User.current.allowed_to?(:edit_checklists_tree, project)
      render_403
      return
    end

    new_state = params[:is_done] == 'true'

    issue    = @item.issue
    was_json = issue.checklist_trees.to_json

    ChecklistTree.transaction do
      @item.is_done = new_state
      @item.save!

      if @item.child?
        # 子の変更 → 親の状態を同期
        @item.sync_parent_done!
      else
        # 親の変更 → 全子をカスケード
        @item.cascade_to_children!(new_state) if @item.parent?
      end
    end

    save_checklist_journal(issue, was_json)

    respond_to do |format|
      format.js
      format.html { redirect_to issue_path(issue) }
    end
  end

  private

  def find_issue
    @issue   = Issue.find(params[:issue_id])
    @project = @issue.project
  rescue ActiveRecord::RecordNotFound
    render_404
  end

  def find_item
    @item    = ChecklistTree.find(params[:id])
    @project = @item.issue.project
  rescue ActiveRecord::RecordNotFound
    render_404
  end

  def item_params
    params.require(:checklist_tree).permit(:subject, :position, :issue_id, :is_done, :parent_id)
  end

  def save_checklist_journal(issue, was_json)
    return unless RedmineChecklistsTree.save_log? || RedmineChecklistsTree.notify?

    became_json = issue.checklist_trees.reload.to_json
    return if was_json == became_json

    journal = issue.init_journal(User.current)
    journal.details << JournalDetail.new(
      property:  'attr',
      prop_key:  'checklist_tree',
      old_value: was_json,
      value:     became_json
    )

    # journal.save! で Redmine の after_create_commit :send_notification が
    # 自動的にメール送信するため、明示的な deliver_issue_edit は不要
    if RedmineChecklistsTree.save_log? || RedmineChecklistsTree.notify?
      journal.save!
    end
  rescue => e
    Rails.logger.error "ChecklistTree journal error: #{e.message}"
  end
end
