import React, { Component } from 'react'
import PropTypes from 'prop-types'

import style from './Profile.css'

export default class Profile extends Component {

  render() {
    let disableSave = true

    if (this.props.updatedSettings || this.props.updatedUserSettings) {
      disableSave = false
    }

    return (
      <form className={style.Profile}>

        <img src={this.props.user.twitterAvatarUrl} />

        <p>
          You are logged in with Twitter as @{this.props.user.twitterScreenName}.
        </p>

        <p>
          <label htmlFor="userName">Your Name:</label>&nbsp;
          <input type="text" id="userName" name="name" placeholder=""
            onChange={this.props.updateUserSettings} value={this.props.user.name}/>
        </p>

        <p>
          <label htmlFor="email">Email:</label>&nbsp;
          <input placeholder="" id="email" name="email" type="email"
            onChange={this.props.updateUserSettings} value={this.props.user.email}/>
        </p>

        <div>
          <button
            type="button"
            onClick={this.props.saveAllSettings}
            disabled={disableSave}>
            Save
          </button>
        </div>

      </form>
    )
  }
}

Profile.propTypes = {
  user: PropTypes.object,
  updatedSettings: PropTypes.bool,
  updatedUserSettings: PropTypes.bool,
  updateUserSettings: PropTypes.func,
  saveAllSettings: PropTypes.func,
}
