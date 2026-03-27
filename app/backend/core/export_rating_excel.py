import pandas as pd
import io

def generate_rating_excel_pandas(queryset) -> bytes:
    data = list(queryset.values(
        'full_name',
        'group__course',
        'faculty__short_name',
        'group__name',
        'group__academic_year',
        'academic_score',
        'research_score',
        'sport_score',
        'social_score',
        'cultural_score',
        '_db_total_score'
    ))

    if not data:
        headers = ['ФИО', 'Курс', 'Факультет', 'Группа', 'Год', 'Учебная', 'Научно-исследовательская', 'Спортивная', 'Общественная', 'Культурно-творческая', 'Всего']
        df = pd.DataFrame(columns=headers)
    else:
        df = pd.DataFrame(data)
        
        df = df.fillna(0) 

        df = df.rename(columns={
            'full_name': 'ФИО',
            'group__course': 'Курс',
            'faculty__short_name': 'Факультет',
            'group__name': 'Группа',
            'group__academic_year': 'Год',
            'academic_score': 'Учебная',
            'research_score': 'Научно-исследовательская',
            'sport_score': 'Спортивная',
            'social_score': 'Общественная',
            'cultural_score': 'Культурно-творческая',
            '_db_total_score': 'Всего'
        })

        column_order = ['ФИО', 'Курс', 'Факультет', 'Группа', 'Год', 'Учебная', 'Научно-исследовательская', 'Спортивная', 'Общественная', 'Культурно-творческая', 'Всего']
        df = df[column_order]

    output = io.BytesIO()
    
    # Используем движок xlsxwriter
    with pd.ExcelWriter(output, engine='xlsxwriter') as writer:
        df.to_excel(writer, index=False, sheet_name='Рейтинг')
        
        workbook = writer.book
        worksheet = writer.sheets['Рейтинг']

        for i, col in enumerate(df.columns):
            column_data = df[col].astype(str).replace('nan', '')
            
            max_len = column_data.map(len).max()
            
            header_len = len(str(col))
            
            final_width = max(max_len, header_len) + 2
            worksheet.set_column(i, i, min(final_width, 50))

    return output.getvalue()