class CreateChecklistTreeConfigs < ActiveRecord::Migration[5.2]
  def change
    create_table :checklist_tree_configs do |t|
      t.integer :issue_id,       null: false
      t.boolean :use_done_ratio, null: false, default: false
      t.timestamps null: false
    end
    add_index :checklist_tree_configs, :issue_id, unique: true
  end
end
