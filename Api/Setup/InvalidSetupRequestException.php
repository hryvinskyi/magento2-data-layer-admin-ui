<?php
/**
 * Copyright (c) 2026. Volodymyr Hryvinskyi. All rights reserved.
 * Author: Volodymyr Hryvinskyi <volodymyr@hryvinskyi.com>
 * GitHub: https://github.com/hryvinskyi
 */

declare(strict_types=1);

namespace Hryvinskyi\DataLayerAdminUi\Api\Setup;

use Magento\Framework\Phrase;

/**
 * A setup wizard request the server refuses because of what the request asks: a body it cannot read, a scope, a
 * setting or a value the wizard does not take
 *
 * It carries the reason as a phrase written for the person using the wizard, which an endpoint may show as it is.
 * Anything else that goes wrong while a request is answered is a fault of the server, not of the request, and its
 * message is never shown.
 *
 * @api
 */
class InvalidSetupRequestException extends \InvalidArgumentException
{
    /**
     * @param Phrase $reason Why the request is refused, for the person using the wizard
     * @param \Throwable|null $previous
     */
    public function __construct(
        private readonly Phrase $reason,
        ?\Throwable $previous = null
    ) {
        parent::__construct($reason->render(), 0, $previous);
    }

    /**
     * Get why the request is refused
     *
     * @return Phrase
     */
    public function getReason(): Phrase
    {
        return $this->reason;
    }
}
