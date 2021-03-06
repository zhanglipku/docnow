import React, { Component } from 'react'
import PropTypes from 'prop-types'
import style from './SearchTerm.css'

export default class SearchTerm extends Component {

  constructor(props) {
    super(props)
    this.value = props.value
  }

  componentDidMount() {
    this.refs.span.focus()
  }

  shouldComponentUpdate(nextProps) {
    // prevent cursor from jumping around when editing
    if (nextProps.value === this.value) {
      return false
    } else {
      return true
    }
  }

  keyDown(e) {
    if (e.key === 'Enter') {
      this.props.createSearch(this.props.query)
      e.stopPropagation()
    }
  }

  update(e) {
    const newValue = e.target.innerText
    this.value = newValue
    this.props.onInput({
      type: this.props.type,
      value: newValue,
      pos: this.props.pos
    })
  }

  click(e) {
    e.stopPropagation()
    if (this.props.onClick) {
      this.props.onClick(e)
    }
  }

  guessType() {
    if (this.props.value.startsWith('#')) {
      return 'hashtag'
    } else if (this.props.value.match(/ /)) {
      return 'phrase'
    } else {
      return 'keyword'
    }
  }

  cssClass(type) {
    switch (type) {
      case 'keyword':
        return style.Keyword
      case 'hashtag':
        return style.Hashtag
      case 'phrase':
        return style.Phrase
      case 'user':
        return style.User
      case 'input':
        return style.Input
      default:
        return ''
    }
  }

  render() {
    const type = this.props.type || this.guessType()
    const cssClass = this.cssClass(type)
    const editable = this.props.onInput ? true : false
    return (
      <span
        spellCheck={false}
        contentEditable={editable}
        suppressContentEditableWarning={editable}
        onKeyDown={(e) => {this.keyDown(e)}}
        onClick={(e) => {this.click(e)}}
        onInput={(e) => {this.update(e)}}
        data-type={type}
        className={style.SearchTerm + ' ' + cssClass}
        ref="span"
        title={`${type} ${this.props.value}`}>
        { this.props.value }
      </span>
    )
  }
}

SearchTerm.propTypes = {
  pos: PropTypes.number,
  type: PropTypes.string,
  value: PropTypes.string,
  onInput: PropTypes.func,
  onClick: PropTypes.func,
  createSearch: PropTypes.func,
  query: PropTypes.array,
}
