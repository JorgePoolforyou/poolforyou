WORK_REPORT_FORM = {
    "version": "1.0",
    "fields": [
        {
            "name": "ph_level",
            "label": "Nivel de pH",
            "type": "number",
            "required": True
        },
        {
            "name": "chlorine_level",
            "label": "Nivel de cloro",
            "type": "number",
            "required": True
        },
        {
            "name": "cleaned_filters",
            "label": "Filtros limpiados",
            "type": "boolean",
            "required": True
        },
        {
            "name": "observations",
            "label": "Observaciones",
            "type": "text",
            "required": False
        }
    ]
}
