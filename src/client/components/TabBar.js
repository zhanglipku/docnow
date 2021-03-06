import React, { Component } from 'react'
import PropTypes from 'prop-types'
import { Link } from 'react-router-dom'

import styles from './TabBar.css'

export default class TabBar extends Component {

  render() {
    let trendsActive = null
    let searchActive = null
    let searchlistActive = null
    switch (this.props.location) {
      case '/':
        trendsActive = styles.TabActive
        break
      case '/explore/':
        searchActive = styles.TabActive
        break
      case '/searches/':
        searchlistActive = styles.TabActive
        break
      default:
        break
    }

    return (
      <div className={styles.TabBar}>
        <ul>
          <li>
            <Link className={`${styles.Tab} ${trendsActive}`} to="/">
              <i className="fa fa-area-chart" aria-hidden="true"/>
              &nbsp;
              Trending
            </Link>
          </li>
          <li>
            <Link className={`${styles.Tab} ${searchActive}`} to="/explore/">
              <i className="fa fa-search" aria-hidden="true"/>
              &nbsp;
              Explore
            </Link>
          </li>
          <li>
            <Link className={`${styles.Tab} ${searchlistActive}`} to="/searches/">
              <i className="fa fa-archive" aria-hidden="true"/>
              &nbsp;
              Saved Searches
            </Link>
          </li>
        </ul>
      </div>
    )
  }

}

TabBar.propTypes = {
  location: PropTypes.string,
  isSuperUser: PropTypes.bool
}
