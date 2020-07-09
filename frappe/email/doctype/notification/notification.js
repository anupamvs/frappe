// Copyright (c) 2018, Frappe Technologies and contributors
// For license information, please see license.txt

this.frm.add_fetch('sender', 'email_id', 'sender_email');

this.frm.fields_dict.sender.get_query = function(){
	return {
		filters: {
			'enable_outgoing': 1
		}
	}
};
frappe.notification = {
	setup_fieldname_select: function(frm) {
		// get the doctype to update fields
		if(!frm.doc.document_type) {
			return;
		}

		frappe.model.with_doctype(frm.doc.document_type, function() {
			let get_select_options = function(df) {
				return {
					value: df.fieldname, 
					label: df.fieldname + " (" + __(df.label) + ")"
				};
			}
			let get_date_change_options = function() {
				let date_options = $.map(fields, function(d) {
					return (d.fieldtype=="Date" || d.fieldtype=="Datetime")?
						get_select_options(d) : null;
				});
				// append creation and modified date to Date Change field
				return date_options.concat([
					{ value: "creation", label: `creation (${__('Created On')})` },
					{ value: "modified", label: `modified (${__('Last Modified Date')})` }
				]);
			}

			let fields = frappe.get_doc("DocType", frm.doc.document_type).fields;
			frm.options = $.map(fields,
				function(d) { return in_list(frappe.model.no_value_type, d.fieldtype) ?
					null : get_select_options(d); });

			// set value changed options
			frm.set_df_property("value_changed", "options", [""].concat(frm.options));
			frm.set_df_property("set_property_after_alert", "options", [""].concat(frm.options));

			// set date changed options
			frm.set_df_property("date_changed", "options", get_date_change_options());

			let email_fields = $.map(fields,
				function(d) { return (d.options == "Email" ||
					(d.options=='User' && d.fieldtype=='Link')) ?
					get_select_options(d) : null; });

			// set email recipient options
			frappe.meta.get_docfield("Notification Recipient", "email_by_document_field",
				// set first option as blank to allow notification not to be defaulted to the owner
				frm.doc.name).options = [""].concat(["owner"].concat(email_fields));

			frm.fields_dict.recipients.grid.refresh();
		});
	}
}

frappe.ui.form.on("Notification", {
	onload: function(frm) {
		frm.set_query("document_type", function() {
			return {
				"filters": {
					"istable": 0
				}
			}
		});
		frm.set_query("print_format", function() {
			return {
				"filters": {
					"doc_type": frm.doc.document_type
				}
			}
		});
		$('[data-fieldname="insert_dynamic_value"]').css({'margin-top': '-33px','float':'right'});
	},
	onload_post_render(frm) {
		$("[data-fieldname='subject']").on("keyup mouseup", e =>{
			frm.last_touched = 'subject';
			frm.last_cursor_position = e.target.selectionStart; 
		});

		$("[data-fieldname='message']").on("keyup mouseup", e =>{
			frm.last_touched = 'message';
			frm.last_cursor_position = frm.get_field("message").editor.getCursorPosition();
		});
	},
	refresh: function(frm) {
		frappe.notification.setup_fieldname_select(frm);
		frm.get_field("is_standard").toggle(frappe.boot.developer_mode);
		frm.trigger('event');
	},
	document_type: function(frm) {
		frappe.notification.setup_fieldname_select(frm);
	},
	event: function(frm) {
		if(in_list(['Days Before', 'Days After'], frm.doc.event)) {
			frm.add_custom_button(__('Get Alerts for Today'), function() {
				frappe.call({
					method: 'frappe.email.doctype.notification.notification.get_documents_for_today',
					args: {
						notification: frm.doc.name
					},
					callback: function(r) {
						if(r.message) {
							frappe.msgprint(r.message);
						} else {
							frappe.msgprint(__('No alerts for today'));
						}
					}
				});
			});
		}
	},
	channel: function(frm) {
		frm.toggle_reqd("recipients", frm.doc.channel=="Email");
	},
	insert_dynamic_value: function(frm) {
		var dialog = new frappe.ui.Dialog({
			title: __('Insert Dynamic Value'),
			fields: [
				{
					fieldtype: 'Autocomplete',
					fieldname: 'fieldname',
					label: __('Select Field'),
					options: frm.options,
					reqd: 1,
					onchange: function() {
						if (frm.last_touched == 'message') {
							frm.get_field('message').editor.session.insert(frm.last_cursor_position,`{{ doc.${this.value} }}`);
						}
						else {
							let value = frm.doc[frm.last_touched].slice(0, frm.last_cursor_position) + `{{ doc.${this.value} }}` + frm.doc[frm.last_touched].slice(frm.last_cursor_position);
							frm.set_value(frm.last_touched, value);
						}
						dialog.hide();
					}
				}
			]
		});
		dialog.show();
	},
	
});
