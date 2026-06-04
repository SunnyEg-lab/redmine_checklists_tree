module ChecklistsTreeHelper
  def clt_new_or_show(f)
    f.object.new_record? && f.object.subject.blank? ? 'new' : 'show'
  end

  def clt_done_css(f)
    f.object.is_done ? 'is-done' : ''
  end

  def clt_remove_field(name, f, options = {})
    f.hidden_field(:_destroy) + link_to(name, 'javascript:void(0)', options)
  end

  def clt_fields_template(f, association)
    new_obj = f.object.class.reflect_on_association(association).klass.new
    f.fields_for(association, new_obj, child_index: "new_#{association}") do |builder|
      render("checklist_tree_fields", f: builder)
    end
  end
end
