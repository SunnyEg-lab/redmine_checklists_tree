/* redmine_checklists_tree */
var ChecklistTree = (function ($) {
  'use strict';

  // =========================================================
  // 表示画面（show） チェックAjax
  // =========================================================
  function initView() {
    $('#checklist_tree_items').on('change', '.clt-checkbox', function () {
      var $cb  = $(this);
      var url  = $cb.data('url');
      var done = $cb.prop('checked');
      $.ajax({ type: 'PUT', url: url, data: { is_done: done }, dataType: 'script' });
    });

  }

  // =========================================================
  // 編集フォーム
  // =========================================================
  var _addIconHtml = '+'; // initForm時にsprite_iconのHTMLで上書き

  function initForm() {
    var $root = $('#clt_form_root');
    if (!$root.length) return;

    // 既存の+ボタンからアイコンHTMLを取得
    var $sampleBtn = $root.find('.clt-add-parent-btn, .clt-add-child-btn').first();
    if ($sampleBtn.length) _addIconHtml = $sampleBtn.html();

    _bindSubjectEdit($root);
    _bindRemove($root);
    _bindAddParent($root);
    _bindAddChild($root);
    _syncPositionFields($root);
    _updateReorderBtnVisibility($root);

    $root.on('click', '.clt-reorder-btn', function (e) {
      e.preventDefault();
      DndMode.open($root);
    });
  }

  // ----- subject クリックでインライン編集 -----
  function _bindSubjectEdit($root) {
    $root.on('click', '.clt-subject', function () {
      var $subj = $(this);
      var $row  = $subj.closest('.clt-item-row');
      var orig  = $subj.text().trim();
      var $input = $('<input type="text" class="clt-subject-input" />').val(orig);
      $subj.replaceWith($input);
      $input.focus().select();

      function commit() {
        var val = $input.val().trim() || orig;
        var $newSubj = $('<span class="clt-subject"></span>').text(val);
        if ($row.find('.clt-item-checkbox').prop('checked')) $newSubj.addClass('is-done');
        $input.replaceWith($newSubj);
        $row.find('.clt-subject-hidden').val(val);
      }
      $input.on('blur', commit);
      $input.on('keydown', function (e) {
        if (e.which === 13) { e.preventDefault(); commit(); }
        if (e.which === 27) {
          $input.replaceWith($('<span class="clt-subject"></span>').text(orig));
        }
      });
    });
  }

  // ----- 削除 -----
  function _bindRemove($root) {
    $root.on('click', '.clt-remove-btn', function (e) {
      e.preventDefault();
      var $btn    = $(this);
      var $row    = $btn.closest('.clt-item-row');
      var $group  = $row.closest('.clt-group');
      var isChild = $row.hasClass('clt-child');
      var isNew   = !$row.find('.clt-id').val(); // ID空 = 未保存アイテム

      if (!isChild) {
        var hasChildren = $group.find('.clt-item-row.clt-child').filter(function() {
          return $(this).find('.clt-destroy-flag').val() !== '1';
        }).length > 0;
        if (hasChildren) {
          alert(clt_i18n.delete_parent_blocked);
          return;
        }
      }

      if (isNew) {
        // 未保存 → DOMごと削除
        if (isChild) {
          $row.fadeOut(150, function () {
            $(this).remove();
            _updateDeleteBtnState($group);
            _syncPositionFields($root);
          });
        } else {
          $group.fadeOut(150, function () {
            $(this).remove();
            _syncPositionFields($root);
            _updateReorderBtnVisibility($root);
          });
        }
      } else {
        // 保存済 → _destroy=1にしてDOMは残す（フォーム送信で削除処理される）
        $row.find('.clt-destroy-flag').val('1');
        if (isChild) {
          $row.fadeOut(150, function () {
            _updateDeleteBtnState($group);
            _syncPositionFields($root);
          });
        } else {
          $group.fadeOut(150);
          _syncPositionFields($root);
        }
      }
    });
  }

  function _updateDeleteBtnState($group) {
    var hasChildren = $group.find('.clt-item-row.clt-child').filter(function() {
      return $(this).find('.clt-destroy-flag').val() !== '1';
    }).length > 0;
    var $parentBtn  = $group.find('> .clt-item-row .clt-remove-btn');
    $parentBtn.toggleClass('clt-remove-disabled', hasChildren);
    $parentBtn.attr('title', hasChildren ? clt_i18n.delete_parent_blocked : '');
  }

  // ----- 親アイテム追加 -----
  function _bindAddParent($root) {
    function doAdd() {
      var $input = $root.find('#clt_new_item .clt-edit-box');
      var subj = $input.val().trim();
      if (!subj) return;
      _appendParentItem($root, subj);
      $input.val('').focus();
    }
    $root.on('click',   '.clt-add-parent-btn', doAdd);
    $root.on('keydown', '#clt_new_item .clt-edit-box', function (e) {
      if (e.which === 13) { e.preventDefault(); doAdd(); }
    });
  }

  function _appendParentItem($root, subject) {
    var time = new Date().getTime();
    var tmpKey = 'tmp_' + time;
    var $row = _makeItemRow(subject, null, tmpKey);

    var $childInputRow = $(
      '<div class="clt-child-input-row" data-parent-id="' + tmpKey + '">' +
        '<input type="text" class="clt-child-edit-box" placeholder="' + clt_i18n.add_child + '" />' +
        '<button type="button" class="clt-add-child-btn">' + _addIconHtml + '</button>' +
      '</div>'
    );
    var $wrap  = $('<div class="clt-children-wrap"></div>').append($childInputRow);
    var $group = $('<div class="clt-group" data-group-id="' + tmpKey + '"></div>')
                   .append($row).append($wrap);

    $root.find('#clt_new_item').before($group);
    _syncPositionFields($root);
    _updateReorderBtnVisibility($root);
  }

  // ----- 子アイテム追加 -----
  function _bindAddChild($root) {
    function doAddChild($inputRow) {
      var $input  = $inputRow.find('.clt-child-edit-box');
      var subj    = $input.val().trim();
      var parentId = String($inputRow.data('parent-id'));
      if (!subj) return;
      var $row = _makeItemRow(subj, parentId, 'tmp_' + new Date().getTime());
      $row.addClass('clt-child');
      $inputRow.before($row);
      $input.val('').focus();
      _updateDeleteBtnState($inputRow.closest('.clt-group'));
      _syncPositionFields($root);
    }
    $root.on('click', '.clt-add-child-btn', function () {
      doAddChild($(this).closest('.clt-child-input-row'));
    });
    $root.on('keydown', '.clt-child-edit-box', function (e) {
      if (e.which === 13) { e.preventDefault(); doAddChild($(this).closest('.clt-child-input-row')); }
    });
  }

  function _makeItemRow(subject, parentId, tmpKey) {
    var tpl  = $('#clt_item_template').html();
    var time = tmpKey.replace('tmp_', '') || new Date().getTime();
    var html = tpl.replace(/new_checklist_trees/g, time);
    var $row = $(html);
    $row.find('.clt-subject').text(subject);
    $row.find('.clt-subject-hidden').val(subject);
    $row.find('.clt-parent-id').val(parentId || '');
    $row.attr('data-tmp-key', tmpKey);
    return $row;
  }

  // ----- 並べ替えボタンの表示/非表示 -----
  function _updateReorderBtnVisibility($root) {
    var hasItems = $root.find('.clt-item-row.existing').length > 0;
    var $btn = $root.closest('#checklist-tree-form-wrap').find('#clt_reorder_btn_wrap');
    $btn.toggle(hasItems);
  }

  // ----- position 同期 -----
  function _syncPositionFields($root) {
    var pos = 0;
    $root.find('.clt-item-row.existing').each(function () {
      $(this).find('.clt-position').val(pos++);
    });
  }

  // =========================================================
  // DnDテーブルモード（マルチ操作版）
  //   ⠿ クリック → オーバーレイ開く
  //   オーバーレイ内で ⠿ をmousedown → そのまま移動 → 離して1アイテム確定
  //   何度でも繰り返し可能
  //   「完了」ボタンで保存・クローズ / 「キャンセル」で破棄
  // =========================================================
  var DndMode = (function () {

    var _$formRoot = null;
    var _$overlay  = null;
    var _items     = [];
    var _dragKey   = null;
    var _dragType  = null;
    var _$hovered  = null;
    var _dragging  = false;

    // ---- オーバーレイを開く ----
    function open($root) {
      if (_$overlay) return;            // 既に開いている
      _$formRoot = $root;
      _items     = _readItems($root);
      _$overlay  = _buildOverlay();
      $('body').append(_$overlay);
      _bindOverlayDrag();
    }

    // ---- 閉じる ----
    function _close(apply) {
      $(document).off('.cltdnd');
      if (apply) _writeBack();
      _$overlay.remove();
      _$overlay  = null;
      _dragKey   = null;
      _dragType  = null;
      _$hovered  = null;
      _dragging  = false;
    }

    // ---- オーバーレイ内ドラッグ開始 ----
    function _bindOverlayDrag() {
      var $ov = _$overlay;

      // 完了 / キャンセル
      $ov.on('click', '.clt-dnd-apply',  function () { _close(true); });
      $ov.on('click', '.clt-dnd-cancel', function () { _close(false); });
      $(document).on('keydown.cltdnd', function (e) {
        if (e.which === 27) _close(false);
      });

      // オーバーレイ内 ⠿ mousedown → ドラッグ開始
      $ov.on('mousedown', '.clt-dnd-handle-icon', function (e) {
        e.preventDefault();
        var $row  = $(this).closest('.clt-dnd-item-row');
        _dragKey  = String($row.data('key'));
        _dragType = String($row.data('type')) === 'child' ? 'child' : 'parent';
        _dragging = true;

        $row.addClass('clt-dnd-dragging');
        _markValidGaps();

        $(document)
          .on('mousemove.cltdnd', _onMouseMove)
          .on('mouseup.cltdnd',   _onMouseUp);
      });
    }

    // ---- mousemove：ギャップ行ハイライト＋自動スクロール ----
    var _scrollRaf = null;

    function _onMouseMove(e) {
      var el   = document.elementFromPoint(e.clientX, e.clientY);
      var $gap = el ? $(el).closest('.clt-dnd-valid') : $();

      if (_$hovered && (!$gap.length || !_$hovered.is($gap))) {
        _$hovered.removeClass('clt-dnd-hover');
        _$hovered = null;
      }
      if ($gap.length && (!_$hovered || !_$hovered.is($gap))) {
        $gap.addClass('clt-dnd-hover');
        _$hovered = $gap;
      }

      // 自動スクロール
      var $panel = _$overlay ? _$overlay.find('.clt-dnd-panel') : $();
      if ($panel.length) {
        var panelRect = $panel[0].getBoundingClientRect();
        var zone = 60; // 端からN px以内でスクロール
        var speed = 8;
        var scrollDir = 0;
        if (e.clientY < panelRect.top + zone)    scrollDir = -speed;
        else if (e.clientY > panelRect.bottom - zone) scrollDir = speed;

        if (_scrollRaf) { cancelAnimationFrame(_scrollRaf); _scrollRaf = null; }
        if (scrollDir !== 0) {
          (function scroll() {
            $panel[0].scrollTop += scrollDir;
            _scrollRaf = requestAnimationFrame(scroll);
          })();
        }
      }
    }

    // ---- mouseup：1アイテム確定（オーバーレイは閉じない） ----
    function _onMouseUp(e) {
      if (_scrollRaf) { cancelAnimationFrame(_scrollRaf); _scrollRaf = null; }
      $(document).off('mousemove.cltdnd mouseup.cltdnd');

      var $drop = _$hovered;
      if ($drop && $drop.length) {
        var gapType = String($drop.attr('data-gap-type') || '');
        var gapPKey = $drop.attr('data-gap-parent-key') || null;
        if (gapPKey === '') gapPKey = null;
        // 文字列として統一（jQueryのdata()は数値変換するためattr()を使用）
        if (gapPKey !== null) gapPKey = String(gapPKey);
        _performDrop(_dragKey, gapType, gapPKey, $drop);
        // テーブルを再描画して次の操作へ
        _renderTable(_$overlay);
      }

      // ドラッグ状態リセット
      _dragKey  = null;
      _dragType = null;
      _$hovered = null;
      _dragging = false;
      if (_$overlay) {
        _$overlay.find('.clt-dnd-dragging').removeClass('clt-dnd-dragging');
        _$overlay.find('.clt-dnd-valid, .clt-dnd-invalid, .clt-dnd-hover')
                 .removeClass('clt-dnd-valid clt-dnd-invalid clt-dnd-hover');
      }
    }

    // ---- フォームからitems読み取り ----
    function _readItems($root) {
      var items = [];
      $root.find('.clt-item-row.existing').each(function () {
        var $row = $(this);
        var key  = $row.find('.clt-id').val() || $row.attr('data-tmp-key') || ('tmp_' + items.length);
        items.push({
          key:       String(key),
          subject:   $row.find('.clt-subject-hidden').val() || $row.find('.clt-subject').text().trim(),
          isDone:    $row.find('.clt-item-checkbox').prop('checked'),
          parentId:  $row.find('.clt-parent-id').val() ? String($row.find('.clt-parent-id').val()) : null,
          $formItem: $row
        });
      });
      return items;
    }

    // ---- オーバーレイ（テーブル）生成 ----
    function _buildOverlay() {
      var $ov = $(
        '<div class="clt-dnd-overlay">' +
          '<div class="clt-dnd-panel">' +
            '<p class="clt-dnd-hint">⠿ を掴んで離すと移動確定。何度でも変更できます。グレー部分には移動できません。<span class="clt-dnd-resize-hint">右端をドラッグで幅を調整できます</span></p>' +
            '<div class="clt-dnd-table-wrap"></div>' +
            '<div class="clt-dnd-footer">' +
              '<button type="button" class="clt-dnd-apply button">完了</button>' +
              '&nbsp;' +
              '<button type="button" class="clt-dnd-cancel">キャンセル</button>' +
            '</div>' +
          '</div>' +
        '</div>'
      );
      _renderTable($ov);
      return $ov;
    }

    function _renderTable($ov) {
      var $wrap = $ov.find('.clt-dnd-table-wrap');
      $wrap.empty();

      var $tbl  = $('<table class="clt-dnd-table"><thead><tr><th>親 / 単独</th><th>子</th></tr></thead><tbody></tbody></table>');
      var $body = $tbl.find('tbody');
      var parents = _items.filter(function (i) { return !i.parentId; });

      $body.append(_gapRow('parent', null));

      parents.forEach(function (parent) {
        var children = _items.filter(function (i) { return i.parentId === parent.key; });
        $body.append(_itemRow(parent, 'parent'));
        $body.append(_gapRow('child', parent.key));
        children.forEach(function (child) {
          $body.append(_itemRow(child, 'child'));
          $body.append(_gapRow('child', parent.key));
        });
        $body.append(_gapRow('parent', null));
      });

      $wrap.append($tbl);
    }

    function _itemRow(item, type) {
      var doneClass = item.isDone ? 'is-done' : '';
      var handle    = '<span class="clt-dnd-handle-icon">⠿</span>';
      var label     = '<span class="clt-dnd-label ' + doneClass + '">' + _esc(item.subject) + '</span>';
      var cell      = '<td class="clt-dnd-item-cell">' + handle + label + '</td>';
      var disabled  = '<td class="clt-dnd-disabled"></td>';

      var $tr = $('<tr class="clt-dnd-item-row"></tr>')
        .attr('data-key', item.key)
        .attr('data-type', type);

      if (type === 'child') {
        $tr.html(disabled + cell);
      } else {
        $tr.html(cell + disabled);
      }
      return $tr;
    }

    function _gapRow(type, parentKey) {
      var $tr = $('<tr class="clt-dnd-gap-row"></tr>')
        .attr('data-gap-type',       type)
        .attr('data-gap-parent-key', parentKey || '');

      if (type === 'parent') {
        $tr.html('<td class="clt-dnd-gap-cell"></td><td class="clt-dnd-disabled"></td>');
      } else {
        $tr.html('<td class="clt-dnd-disabled"></td><td class="clt-dnd-gap-cell"></td>');
      }
      return $tr;
    }

    function _esc(s) {
      return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
    }


    // ---- 有効ギャップをマーク ----
    function _markValidGaps() {
      // 掴んでいるアイテムが実際に子を持つ「親」かどうか確認
      var hasChildren = _items.some(function(i) { return i.parentId === _dragKey; });

      _$overlay.find('.clt-dnd-gap-row').each(function () {
        var gapType = $(this).attr('data-gap-type') || '';
        var valid;
        if (_dragType === 'parent' && hasChildren) {
          // 子持ち親 → 親レベルのgapのみ（他の親の下には入れない）
          valid = gapType === 'parent';
        } else {
          // 子・単独アイテム → 全gap有効（親の下にも移動可能）
          valid = true;
        }
        $(this).toggleClass('clt-dnd-valid',   valid)
               .toggleClass('clt-dnd-invalid', !valid);
      });
    }

    // ---- ドロップ実行 ----
    function _performDrop(key, gapType, gapParentKey, $gap) {
      var item = _items.find(function (i) { return i.key === key; });
      if (!item) return;

      item.parentId = (gapType === 'child') ? gapParentKey : null;

      _items = _items.filter(function (i) { return i.key !== key; });
      var insertIdx = _gapToInsertIndex($gap, gapType, gapParentKey);
      _items.splice(insertIdx, 0, item);
    }

    function _gapToInsertIndex($gap, gapType, gapParentKey) {
      var $prevItem = $gap.prevAll('.clt-dnd-item-row').first();
      if (!$prevItem.length) return 0;

      var prevKey = String($prevItem.data('key'));
      var idx     = _items.findIndex(function (i) { return i.key === prevKey; });
      if (idx < 0) return _items.length;

      if (gapType === 'parent') {
        var end = idx;
        while (end + 1 < _items.length && String(_items[end + 1].parentId) === prevKey) { end++; }
        return end + 1;
      }
      return idx + 1;
    }

    // ---- フォームへ書き戻し（DOM再構築） ----
    function _writeBack() {
      var $root    = _$formRoot;
      var $newItem = $root.find('#clt_new_item');

      // hidden fields更新
      _items.forEach(function (item, pos) {
        item.$formItem.find('.clt-position').val(pos);
        item.$formItem.find('.clt-parent-id').val(item.parentId || '');
        item.$formItem.removeClass('clt-child');
      });

      // 既存グループを全削除してから再構築
      $root.find('.clt-group').remove();

      var parents = _items.filter(function (i) { return !i.parentId; });
      parents.forEach(function (parent) {
        var children = _items.filter(function (i) { return i.parentId === parent.key; });
        var groupId  = parent.$formItem.find('.clt-id').val() || parent.$formItem.attr('data-tmp-key');

        var $group = $('<div class="clt-group" data-group-id="' + groupId + '"></div>');
        $group.append(parent.$formItem);

        var $wrap = $('<div class="clt-children-wrap"></div>');
        children.forEach(function (child) {
          child.$formItem.addClass('clt-child');
          $wrap.append(child.$formItem);
        });

        var $childInput = $(
          '<div class="clt-child-input-row" data-parent-id="' + groupId + '">' +
            '<input type="text" class="clt-child-edit-box" placeholder="' + clt_i18n.add_child + '" />' +
            '<button type="button" class="clt-add-child-btn">' + _addIconHtml + '</button>' +
          '</div>'
        );
        $wrap.append($childInput);
        $group.append($wrap);
        $newItem.before($group);
      });

      _syncPositionFields($root);
    }

    function _syncPositionFields($root) {
      var pos = 0;
      $root.find('.clt-item-row.existing').each(function () {
        $(this).find('.clt-position').val(pos++);
      });
    }

    return { open: open };
  })();

  // =========================================================
  return { initView: initView, initForm: initForm };
  // =========================================================

})(jQuery);

// i18n文字列（Viewから差し込む）
var clt_i18n = clt_i18n || {
  delete_parent_blocked: '子アイテムを先に削除してください',
  add_child: '子を追加...'
};
