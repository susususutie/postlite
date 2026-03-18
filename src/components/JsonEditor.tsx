import { Input } from 'antd';

const { TextArea } = Input;

interface JsonEditorProps {
  value: string;
  onChange?: (value: string) => void;
  language?: 'json' | 'text';
  readOnly?: boolean;
  height?: number | string;
}

export const JsonEditor: React.FC<JsonEditorProps> = ({
  value,
  onChange,
  language = 'json',
  readOnly = false,
  height = 200,
}) => {
  const handleChange = (e: { target: { value: string } }) => {
    onChange?.(e.target.value);
  };

  const formatJson = () => {
    if (language === 'json' && value && onChange) {
      try {
        const parsed = JSON.parse(value);
        onChange(JSON.stringify(parsed, null, 2));
      } catch {
        // Invalid JSON, ignore
      }
    }
  };

  return (
    <div style={{ position: 'relative' }}>
      {language === 'json' && !readOnly && value && (
        <button
          onClick={formatJson}
          style={{
            position: 'absolute',
            top: 4,
            right: 4,
            zIndex: 10,
            background: '#f0f0f0',
            border: '1px solid #d9d9d9',
            borderRadius: 4,
            padding: '2px 8px',
            fontSize: 12,
            cursor: 'pointer',
          }}
        >
          Format
        </button>
      )}
      <TextArea
        value={value}
        onChange={handleChange}
        readOnly={readOnly}
        style={{
          height,
          fontFamily: 'Monaco, Menlo, "Ubuntu Mono", Consolas, monospace',
          fontSize: 13,
          lineHeight: '1.5',
          resize: 'vertical',
        }}
        placeholder={language === 'json' ? 'Enter JSON content...' : 'Enter content...'}
      />
    </div>
  );
};
