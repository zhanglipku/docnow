import React from 'react'
import MediaQueryComponent from '../MediaQueryComponent'
import PropTypes from 'prop-types'
import Place from './Place'
import AddPlace from './AddPlace'

import card from '../Card.css'
import style from './Trends.css'

export default class Trends extends MediaQueryComponent {

  constructor(props) {
    super(props)
  }

  componentDidMount() {
    this.props.getTrends()
    const intervalId = setInterval(this.props.getTrends, 3000)
    this.setState((prevState) => {
      return Object.assign(prevState, {intervalId: intervalId})
    })
    this.setMediaQuery('(max-width: 780px)', style.Trends, style.Mobile)
  }

  componentWillUnmount() {
    if (this.state.intervalId) {
      clearInterval(this.state.intervalId)
    }
    this.setState({intervalId: null})
  }

  render() {
    const loggedIn = this.props.username ? true : false
    let introElement = null
    let newLocation = null
    if (!loggedIn) {
      introElement = (
        <div className={style.Intro}>
          <p>
          Welcome to DocNow, an social media appraisal tool.
          </p>
          <button onClick={() => {window.location = '/auth/twitter'; return false}}>
            <i className="fa fa-twitter" aria-hidden="true"/>  Login with Twitter
          </button>
        </div>
      )
    } else {
      newLocation = (
        <AddPlace
          limit={5}
          places={this.props.trends}
          world={this.props.world}
          newPlace={this.props.newPlace}
          updateNewTrend={this.props.updateNewTrend}
          placeLabelToId={this.props.placeLabelToId}
          deleteTrend={this.props.deleteTrend}
          saveTrends={this.props.saveTrends} />
      )
    }

    return (
      <div>
        <div className={this.state.mediaStyle}>
          {introElement}
          <div className={card.CardHolder}>
            {this.props.trends.map(place => (
              <Place
                key={place.name}
                trends={place.trends}
                placeId={place.placeId}
                name={place.name}
                world={this.props.world}
                deleteTrend={this.props.deleteTrend}
                username={this.props.username}
                createSearch={this.props.createSearch}/>
            ))}
          </div>
          {newLocation}
        </div>
      </div>
    )
  }
}

Trends.propTypes = {
  username: PropTypes.string,
  trends: PropTypes.array,
  getTrends: PropTypes.func,
  world: PropTypes.object,
  updateNewTrend: PropTypes.func,
  newPlace: PropTypes.string,
  placeLabelToId: PropTypes.func,
  deleteTrend: PropTypes.func,
  createSearch: PropTypes.func
}
