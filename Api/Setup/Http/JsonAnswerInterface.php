<?php
/**
 * Copyright (c) 2026. Volodymyr Hryvinskyi. All rights reserved.
 * Author: Volodymyr Hryvinskyi <volodymyr@hryvinskyi.com>
 * GitHub: https://github.com/hryvinskyi
 */

declare(strict_types=1);

namespace Hryvinskyi\DataLayerAdminUi\Api\Setup\Http;

use Magento\Framework\Controller\Result\Json;

/**
 * Answers a setup wizard endpoint with JSON, the same way for every endpoint
 *
 * What the work returns is the answer. A request the work refuses (an `InvalidSetupRequestException`) answers 400
 * `{"error": reason}` with the refusal's own reason. Anything else that goes wrong is logged with the endpoint and the
 * exception, and answers 500 `{"error": text}` with one generic sentence: an exception's own message may name
 * internals, so it never reaches the browser.
 *
 * @api
 */
interface JsonAnswerInterface
{
    /**
     * Run an endpoint's work and answer with its outcome
     *
     * @param string $endpoint The endpoint's name, logged with a failure
     * @param callable $work Reads the request and runs the use case; returns the answer's data
     * @phpstan-param callable(): mixed $work
     * @return Json
     */
    public function answer(string $endpoint, callable $work): Json;
}
