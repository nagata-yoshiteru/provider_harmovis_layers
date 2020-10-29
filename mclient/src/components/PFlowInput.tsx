import * as React from 'react';

interface Props {
  actions: any,
  i18n?: { formatError: string },
  id?: string,
  className?: string,
  style?: React.CSSProperties,
}

export default class PFlowInput extends React.Component<Props> {
  static defaultProps = {
    i18n: {
      formatError: 'データ形式不正'
    }
  }

  onSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const { actions } = this.props;
    const reader = new FileReader();
    const file = e.target.files[0];
    if (!file) {
      return;
    }
    actions.setLoading(true);
    reader.readAsText(file);
    const file_name: string = file.name;
    reader.onload = () => {
      let readdata = [];
      try {
        readdata = JSON.parse(reader.result.toString());
      } catch (exception) {
        actions.setLoading(false);
        window.alert(exception);
        return;
      }
      if (readdata.length > 0) {
        actions.setInputFilename({ movesFileName: file_name });
        console.log(readdata[0]);
        actions.setMovesBase(readdata);
        actions.setLoading(false);
      }
      actions.setInputFilename({ movesFileName: null });
      actions.setLoading(false);
    };
  }


  render() {
    const { id, className, style } = this.props;

    return (
      <input type="file" accept=".json" 
      id={id} className={className} style={style}
      onChange={this.onSelect.bind(this)}
      />
    );
  }
}
