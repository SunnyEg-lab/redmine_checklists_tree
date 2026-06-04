RedmineApp::Application.routes.draw do
  resources :issues do
    resources :checklist_trees, only: [:index, :create], controller: 'checklists_tree'
  end

  resources :checklist_trees, only: [:show, :update, :destroy], controller: 'checklists_tree' do
    member do
      put :done
    end
  end
end
