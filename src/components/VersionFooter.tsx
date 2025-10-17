/* global __APP_VERSION__, __GIT_COMMIT__, __GIT_COMMIT_URL__, __RELEASE_URL__ */
import React from 'react'

const VersionFooter: React.FC = () => {
  return (
    <div className="text-xs opacity-60 mt-4 px-4 pb-3 select-text">
      <span>
        {typeof __RELEASE_URL__ !== 'undefined' && __RELEASE_URL__ ? (
          <a href={__RELEASE_URL__} target="_blank" rel="noopener noreferrer">
            Version {typeof __APP_VERSION__ !== 'undefined' ? __APP_VERSION__ : 'dev'}
          </a>
        ) : (
          `Version ${typeof __APP_VERSION__ !== 'undefined' ? __APP_VERSION__ : 'dev'}`
        )}
      </span>
      {typeof __GIT_COMMIT__ !== 'undefined' && __GIT_COMMIT__ ? (
        <span>
          {' '}·{' '}
          {typeof __GIT_COMMIT_URL__ !== 'undefined' && __GIT_COMMIT_URL__ ? (
            <a href={__GIT_COMMIT_URL__} target="_blank" rel="noopener noreferrer">
              <code>{__GIT_COMMIT__.slice(0, 7)}</code>
            </a>
          ) : (
            <code>{__GIT_COMMIT__.slice(0, 7)}</code>
          )}
        </span>
      ) : null}
    </div>
  )
}

export default VersionFooter
