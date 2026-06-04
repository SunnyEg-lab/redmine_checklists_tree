class CreateChecklistTrees < ActiveRecord::Migration[5.2]
  def change
    create_table :checklist_trees do |t|
      t.references :issue,   null: false, index: true
      t.integer    :parent_id
      t.string     :subject,  null: false, limit: 512
      t.boolean    :is_done,  default: false, null: false
      t.integer    :position, default: 1,     null: false
      t.integer    :author_id
      t.timestamps null: false
    end

    add_index :checklist_trees, :parent_id
  end
end
