import pandas as pd
import io

def generate_rating_excel_pandas(queryset) -> bytes:
    fields = [
        'full_name', 'group__course', 'faculty__short_name', 
        'group__name', 'group__academic_year', 
        'academic_score', 'research_score', 'sport_score', 'social_score', 'cultural_score', 'total_score'
    ]
    
    data = list(queryset.values(*fields))

    if not data:
        column_order = ['ФИО', 'Курс', 'Факультет', 'Группа', 'Год', 'Учебная', 'Научно-исследовательская', 'Спортивная', 'Общественная', 'Культурно-творческая', 'Всего']
        df = pd.DataFrame(columns=column_order)
    else:
        df = pd.DataFrame(data)
        
        rename_map = {
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
            'total_score': 'Всего'
        }
        
        df = df.rename(columns=rename_map)
        df = df.fillna(0)

        # фильтруем column_order, оставляя только те колонки, которые есть в df
        final_columns = [col for col in rename_map.values() if col in df.columns]
        df = df[final_columns]

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